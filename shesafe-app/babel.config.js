module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Disable worklets - we don't use react-native-reanimated
          // This prevents babel-preset-expo from trying to load react-native-worklets/plugin
          worklets: false,
          reanimated: false,
        },
      ],
    ],
  };
};
