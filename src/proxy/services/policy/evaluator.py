from __future__ import annotations

import os
from typing import Any

from proxy.models.policy.flow import AppConfig, Policy, PolicyStep
from proxy.services.policy.custom_nodes import CustomNodeRunner
from proxy.services.policy.operators import OperatorRunner


class PolicyEvaluator:
    def __init__(self, config: AppConfig, custom_nodes=None, operators=None, max_steps: int | None = None):
        self.config = config
        self.custom_nodes = custom_nodes or CustomNodeRunner(config)
        self.operators = operators or OperatorRunner()
        self.max_steps = max_steps if max_steps is not None else _max_steps_from_env()

    def evaluate(self, context) -> None:
        for policy in self.config.active_mode().policies:
            self._evaluate_policy(policy, context)
            if getattr(context.flow, "response", None) is not None:
                return

    def _evaluate_policy(self, policy: Policy, context) -> None:
        step = policy.start_step()
        input_value: Any = None
        executed = 0

        while True:
            executed += 1
            if executed > self.max_steps:
                raise RuntimeError(f"Policy exceeded max steps: {policy.id}")

            output, input_value = self._execute_step(step, input_value, context)
            if step.kind == "node" and step.type == "end":
                return
            next_id = policy.next_step_id(step.id, output)
            if next_id is None and step.kind == "operator" and step.type == "switch":
                next_id = policy.next_step_id(step.id, "default")
            if next_id is None:
                return
            step = policy.step_by_id(next_id)

    def _execute_step(self, step: PolicyStep, input_value: Any, context) -> tuple[str, Any]:
        if step.kind == "node":
            return self._execute_node(step, input_value, context)
        if step.kind == "operator":
            return self.operators.evaluate(step, input_value), input_value
        raise ValueError(f"Unknown policy step kind: {step.kind}")

    def _execute_node(self, step: PolicyStep, input_value: Any, context) -> tuple[str, Any]:
        if step.type == "start":
            return "next", input_value
        if step.type == "end":
            return "end", input_value
        return "next", self.custom_nodes.run(step, input_value, context)


def _max_steps_from_env() -> int:
    if "POLICY_MAX_STEPS" not in os.environ:
        raise RuntimeError("Missing POLICY_MAX_STEPS")
    value = int(os.environ["POLICY_MAX_STEPS"])
    if value <= 0:
        raise ValueError("POLICY_MAX_STEPS must be greater than zero")
    return value
