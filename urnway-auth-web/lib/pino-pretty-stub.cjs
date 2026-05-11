module.exports = {
  prettyFactory() {
    return function passthroughPrettyFactory(value) {
      return value;
    };
  },
};
