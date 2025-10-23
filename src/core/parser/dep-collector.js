/**
 * 根据 entries 建立 concerning_op 到 生产者 的映射
 * @param {Array} entries   算子条目数组
 * @param {Array} laneOrder  泳道id数组
 * @returns {Map} 返回 Map: concerning_op_name, {ts, laneKey, cycStart, cycEnd}
 */
export function collectProducers(entries, laneOrder) {
  const prod = new Map();          // concerning_op_name -> 生产者信息
  const laneIdx = new Map(laneOrder.map((k, i) => [k, i]));

  entries.forEach(e => {
    const key = `${e.timestep_type}_${e.timestep}`; // 与 laneKey 保持一致
    const key_only = `${e.timestep_type}`; // 仅 lane 类型
    //console.log('checking key', key);
    if (e.timestep_type !== 'gdma') return;   // layer 不登记
    const name = e.concerning_op_name;        // 消费者名字
    // 把“当前gdma”登记为生产者
    prod.set(name, {
      op: name,
      ts: e.timestep,
      laneKey: key,
      laneIndex: laneIdx.get(key_only),
      cycStart: e._cycStart,   // 后面会回填
      cycEnd: e._cycEnd
    });
  });
  // console.log('producers', {prod});
  return prod;
}

/**
 * 建立消费者 -> 生产者 的依赖数组
 * @param {Array} entries   算子条目数组
 * @param {Array} laneOrder  泳道id数组
 * @return 返回依赖数组
 * 
 */
export function buildDeps(entries, laneOrder) {
  const producers = collectProducers(entries, laneOrder);
  const deps = [];

  entries.forEach(e => {
    if (e.timestep_type !== 'layer') return;  // gdma 不配对

    const pname = e.tensor_name;
    //console.log('checking', pname, e);
    if (!producers.has(pname)) return;
    const consumer = {
      op: e.tensor_name,
      ts: e.timestep,
      laneKey: `${e.timestep_type}_${e.timestep}`, 
      laneIndex: laneOrder.indexOf(e.timestep_type), 
      cycStart: e._cycStart,
      cycEnd: e._cycEnd
    };
    deps.push({ from: producers.get(pname), to: consumer });
  });
  return deps;
}