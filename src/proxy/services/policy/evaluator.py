from __future__ import annotations

import os
import time
from typing import Any, Callable

from proxy.models.policy.flow import AppConfig, Policy, PolicyStep
from proxy.api import Request
from proxy.services.events import observability
from proxy.services.policy.custom_nodes import CustomNodeRunner
from proxy.services.policy.operators import OperatorRunner, compile_callable


class PolicyEvaluator:
    def __init__(self, config: AppConfig, custom_nodes=None, operators=None, max_steps: int | None = None, verbose: bool | None = None):
        self.config = config
        self.custom_nodes = custom_nodes or CustomNodeRunner(config)
        self.operators = operators or OperatorRunner()
        self.max_steps = max_steps if max_steps is not None else _max_steps_from_env()
        self.verbose = verbose if verbose is not None else _verbose_from_env()
        self.shared_state: dict[str, Any] = {}
        self._triggers: dict[str, Callable] = {}

    def evaluate(self, context) -> None:
        context.shared_state = self.shared_state
        if self.verbose:
            observability.request_started(context)
        started = time.perf_counter()
        try:
            for policy in self.config.active_policies():
                self._evaluate_policy(policy, context)
                if getattr(context.flow, "response", None) is not None:
                    observability.request_finished(context, "blocked", policy, (time.perf_counter() - started) * 1000)
                    return
            observability.request_finished(context, "allowed", duration_ms=(time.perf_counter() - started) * 1000)
        except Exception as error:
            observability.request_failed(context, error)
            raise

    def _evaluate_policy(self, policy: Policy, context) -> None:
        step = policy.start_step()
        input_value: Any = None
        executed = 0
        if self.verbose:
            observability.policy_started(context, policy)

        try:
            while True:
                executed += 1
                if executed > self.max_steps:
                    raise RuntimeError(f"Policy exceeded max steps: {policy.id}")

                output, input_value, duration_ms = self._run_step(policy, step, input_value, context)
                if step.kind == "node" and step.type == "end":
                    if self.verbose:
                        observability.policy_step(context, policy, step, output, output, None, duration_ms)
                        observability.policy_finished(context, policy, "end")
                    return
                next_id = policy.next_step_id(step.id, output)
                route_output = output
                if next_id is None and step.kind == "operator" and step.type == "switch":
                    next_id = policy.next_step_id(step.id, "default")
                    route_output = "default" if next_id is not None else output
                if self.verbose:
                    observability.policy_step(context, policy, step, output, route_output, next_id, duration_ms)
                if next_id is None:
                    if self.verbose:
                        observability.policy_finished(context, policy, "no_route")
                    return
                step = policy.step_by_id(next_id)
        except Exception as error:
            observability.policy_error(context, policy, step, error)
            raise

    def _run_step(self, policy: Policy, step: PolicyStep, input_value: Any, context) -> tuple[str, Any, float]:
        if not self.verbose:
            output, input_value = self._execute_scoped_step(policy, step, input_value, context)
            return output, input_value, 0.0
        started = time.perf_counter()
        output, input_value = self._execute_scoped_step(policy, step, input_value, context)
        return output, input_value, (time.perf_counter() - started) * 1000

    def _execute_scoped_step(self, policy: Policy, step: PolicyStep, input_value: Any, context) -> tuple[str, Any]:
        previous = context.data.get(observability.SCOPE_KEY)
        context.data[observability.SCOPE_KEY] = {
            "policyId": policy.id,
            "policyName": policy.name,
            "stepId": step.id,
            "stepKind": step.kind,
            "stepType": step.type,
        }
        try:
            return self._execute_step(step, input_value, context)
        finally:
            if previous is None:
                context.data.pop(observability.SCOPE_KEY, None)
            else:
                context.data[observability.SCOPE_KEY] = previous

    def _execute_step(self, step: PolicyStep, input_value: Any, context) -> tuple[str, Any]:
        if step.kind == "node":
            return self._execute_node(step, input_value, context)
        if step.kind == "operator":
            return self.operators.evaluate(step, input_value), input_value
        raise ValueError(f"Unknown policy step kind: {step.kind}")

    def _execute_node(self, step: PolicyStep, input_value: Any, context) -> tuple[str, Any]:
        if step.type == "start":
            return self._evaluate_trigger(step, context), input_value
        if step.type == "end":
            return "end", input_value
        return "next", self.custom_nodes.run(step, input_value, context)

    def _evaluate_trigger(self, step: PolicyStep, context) -> str:
        code = step.params.get("code")
        if not code:
            return "next"
        function = self._triggers.get(str(code))
        if function is None:
            function = compile_callable(str(code), "triggered_by", {"Request": Request})
            self._triggers[str(code)] = function
        return "next" if bool(function(Request(context))) else "skip"


def _max_steps_from_env() -> int:
    if "POLICY_MAX_STEPS" not in os.environ:
        raise RuntimeError("Missing POLICY_MAX_STEPS")
    value = int(os.environ["POLICY_MAX_STEPS"])
    if value <= 0:
        raise ValueError("POLICY_MAX_STEPS must be greater than zero")
    return value


def _verbose_from_env() -> bool:
    if "PRODUCTIVE_PROXY_TELEMETRY_VERBOSE" not in os.environ:
        raise RuntimeError("Missing PRODUCTIVE_PROXY_TELEMETRY_VERBOSE")
    return os.environ["PRODUCTIVE_PROXY_TELEMETRY_VERBOSE"].strip().lower() == "true"
