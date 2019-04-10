'use strict';

/**
 * 当 query 中包含 populate 时，从 cache 中提取数据所做的额外处理
 * @param {Object|Array<Object>} data - cache 的原始对象数据
 * @param {Mongoose} mongoose - 全局 mongoose 实例
 * @param {string} modelName - data 所属的数据表名称
 * @param {Object} populateOption - populate options
 * @returns {Object|Array<Object>} 处理过的数据
 */
function handleQueryPopulate(data, mongoose, modelName, populateOption) {
  // console.log('[isPopulate]', populateOption, Object.keys(populateOption));
  const model = mongoose.model(modelName);
  const schema = model.schema;

  // 需要 populate 的字段列表
  let subPaths = Object.keys(populateOption);
  // 字段至关联 model 的映射
  const pathToModelMap = subPaths.reduce((_map, path) => {
    let refModel;
    let _modelName = populateOption[path].model;
    if (!_modelName) {
      // console.log(schema.path(path));
      // 从 schema 中尝试提取 model name
      _modelName = ((schema.path(path) || {}).options || {}).ref;
    }
    _modelName && (refModel = mongoose.model(_modelName));
    refModel && (_map[path] = refModel);
    return _map;
  }, {});
  subPaths = Object.keys(pathToModelMap);

  const handleDoc = (doc) => {
    const _doc = model.hydrate(doc);
    subPaths.forEach((path) => {
      const val = doc[path];
      const refModel = pathToModelMap[path];
      _doc[path] = Array.isArray(val) ?
        val.map(refModel.hydrate) :
        refModel.hydrate(val);
    });
    return _doc;
  };

  if (Array.isArray(data)) {
    return data.map(handleDoc);
  } else {
    return handleDoc(data);
  }
}

module.exports = handleQueryPopulate;
