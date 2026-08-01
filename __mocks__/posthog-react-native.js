// Manual mock for posthog-react-native (auto-applied for this node_module).
// Every constructed client shares these jest.fn spies so tests can assert on
// captures without touching the real SDK or the network.
const captureMock = jest.fn();
const identifyMock = jest.fn();
const resetMock = jest.fn();
const screenMock = jest.fn();
const registerMock = jest.fn();

class PostHog {
  constructor(apiKey, options) {
    this.apiKey = apiKey;
    this.options = options;
    this.capture = captureMock;
    this.identify = identifyMock;
    this.reset = resetMock;
    this.screen = screenMock;
    this.register = registerMock;
  }
  flush() {
    return Promise.resolve();
  }
  optIn() {}
  optOut() {}
}

// Expose the shared spies for assertions and reset between tests.
PostHog.__mocks = {
  capture: captureMock,
  identify: identifyMock,
  reset: resetMock,
  screen: screenMock,
  register: registerMock,
};

module.exports = PostHog;
module.exports.default = PostHog;
module.exports.PostHog = PostHog;
