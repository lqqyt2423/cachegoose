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

    // 从 schema 中尝试提取 model name
    if (!_modelName) {
      const _schemaType = schema.path(path);
      const _pathType = schema.pathType(path);
      // console.log('path', path);
      // console.log('_schemaType', _schemaType);
      // console.log('_pathType', _pathType);

      if (_pathType === 'real') {
        // 正常的 schema
        if (_schemaType.options && _schemaType.options.ref) {
          _modelName = _schemaType.options.ref;
        }
        // SchemaArray
        if (!_modelName && _schemaType.caster && _schemaType.caster.options && _schemaType.caster.options.ref) {
          _modelName = _schemaType.caster.options.ref;
        }
      }
    }

    if (_modelName) refModel = mongoose.model(_modelName);
    if (refModel) _map[path] = refModel;
    return _map;
  }, {});
  subPaths = Object.keys(pathToModelMap);

  // hydrate doc and populated doc
  const handleDoc = (doc) => {
    const _doc = model.hydrate(doc);

    // replace special field
    const replaceField = (source, target, path, refModel) => {
      if (!source || !target) return;
      if (!refModel) refModel = pathToModelMap[path];

      // handle nested field
      if (path.indexOf('.') > -1) {
        const arr = path.split('.');
        const filed = arr.shift();
        path = arr.join('.');
        return replaceField(source[filed], target[filed], path, refModel);
      }
      const val = source[path];
      target[path] = Array.isArray(val) ?
        val.map(refModel.hydrate.bind(refModel)) :
        refModel.hydrate(val);
    };

    subPaths.forEach((path) => {
      return replaceField(doc, _doc, path);
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
