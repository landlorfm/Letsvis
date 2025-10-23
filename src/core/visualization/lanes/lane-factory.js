import GDMALane from "./gdma-lane";
import LayerLane from "./layer-lane"
import ProfileLane from "./profile-lane"

/**
 * 泳道工厂，根据类型创建对应泳道实例
 */
const TYPE_MAP = {
  gdma: () => new GDMALane(),
  layer: () => new LayerLane(),
  'profile-gdma': () => new ProfileLane('GDMA'),
  'profile-bd': () => new ProfileLane('BD'),
  'profile-layer': () => new ProfileLane('LAYER')
};

/**
 * 创建泳道实例
 * @param {string} type 泳道类型
 * @returns {BaseLane} 泳道实例
 */
export function createLane(type) {
  const Creator = TYPE_MAP[type];
  if (!Creator) throw new Error(`unknown lane ${type}`);
  return Creator();
}

