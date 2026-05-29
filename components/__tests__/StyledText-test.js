import React from 'react';
import { render } from '@testing-library/react-native';

import { MonoText } from '../StyledText';

// Uses @testing-library/react-native (not raw react-test-renderer) so updates are
// wrapped in act() and the renderer is torn down cleanly. The raw renderer crashed
// the process at teardown under React 19 (window.dispatchEvent is not a function).
it('renders correctly', () => {
  const { getByText } = render(<MonoText>Snapshot test!</MonoText>);
  expect(getByText('Snapshot test!')).toBeTruthy();
});
