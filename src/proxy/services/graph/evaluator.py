from __future__ import annotations

from proxy.models.graph.policy_graph import AppConfig, GraphNode
from proxy.services.graph.builtin_nodes import BuiltinNodeRunner
from proxy.services.graph.custom_blocks import CustomBlockRunner


class GraphEvaluator:
    def __init__(self, config: AppConfig, builtins=None, custom_blocks=None):
        self.config = config
        self.builtins = builtins or BuiltinNodeRunner()
        self.custom_blocks = custom_blocks or CustomBlockRunner(config)

    def evaluate(self, context) -> None:
        graph = self.config.active_mode().graph
        node = graph.start_node()

        while True:
            result = self._run_node(node, context)
            context.merge_data(result.data)

            if node.type == "end" or result.output == "end":
                return

            next_id = graph.next_node_id(node.id, result.output)
            if next_id is None:
                return
            node = graph.node_by_id(next_id)

    def _run_node(self, node: GraphNode, context):
        if node.type == "python":
            return self.custom_blocks.run(node, context)
        return self.builtins.run(node, context)
