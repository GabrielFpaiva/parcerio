// Mock oficial da lib: sem SafeAreaProvider, os insets são 0. Teste que
// precisa de insets reais envolve a árvore em <SafeAreaProvider initialMetrics>.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
