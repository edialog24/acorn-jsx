module.exports = function(api) {
  api.cache(true);
  const presets = [["@babel/preset-env",
    {
      targets: {
        browsers: ["cover 100%"]
      }
    }], "@babel/preset-react"];
  const plugins = [
    "@babel/plugin-syntax-dynamic-import",
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
    "@babel/plugin-transform-modules-commonjs",
    ["@babel/plugin-transform-classes",{loose: true}],
    "@babel/plugin-transform-proto-to-assign"
  ];

  return {
    presets,
    plugins
  };
};
