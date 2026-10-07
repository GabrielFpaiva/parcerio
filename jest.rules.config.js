// Config separada: os testes de security rules rodam em Node contra o
// emulador, e não podem usar o preset jest-expo (que assume ambiente RN).
module.exports = {
  displayName: 'rules',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  // Todos os arquivos de teste apontam para o mesmo projectId de emulador e
  // cada um chama clearFirestore() no beforeEach. Rodando em paralelo (padrão
  // do Jest), um arquivo limpa o banco enquanto outro está no meio de um
  // teste — falhas intermitentes e sem relação com as regras. Serializa.
  maxWorkers: 1,
};
