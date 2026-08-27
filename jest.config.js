module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*)',
  ],
  // .worktrees/ holds full nested copies of this project (each an
  // isolated implementation branch checkout). testPathIgnorePatterns alone
  // stops Jest from running those copies' test files, but Jest's haste
  // module map still crawls them for manual mocks/module resolution
  // regardless — surfacing as "jest-haste-map: duplicate manual mock
  // found: react-native-mmkv" and occasional flaky timeouts from the
  // resulting nondeterministic resolution. modulePathIgnorePatterns
  // excludes the directory from that crawl entirely.
  testPathIgnorePatterns: ['/node_modules/', '/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
};
