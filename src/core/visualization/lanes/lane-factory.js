import GDMALane from "./gdma-lane";
import LayerLane from "./layer-lane"

const TYPE_MAP = {
  gdma: () => new GDMALane(),
  layer: () => new LayerLane(),
};

export function createLane(type) {
  const Creator = TYPE_MAP[type];
  if (!Creator) throw new Error(`unknown lane ${type}`);
  return Creator();
}

