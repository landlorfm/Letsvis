import GDMALane from "./gdma-lane";
import LayerLane from "./layer-lane"
import ProfileLane from "./profile-lane"

const TYPE_MAP = {
  gdma: () => new GDMALane(),
  layer: () => new LayerLane(),
  'profile-gdma': () => new ProfileLane('GDMA'),
  'profile-bd': () => new ProfileLane('BD'),
  'profile-layer': () => new ProfileLane('LAYER')
};

export function createLane(type) {
  const Creator = TYPE_MAP[type];
  if (!Creator) throw new Error(`unknown lane ${type}`);
  return Creator();
}

