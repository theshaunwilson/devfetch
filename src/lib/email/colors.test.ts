import { describe, expect, it } from 'vitest';

import { contrast, token } from '../../../test/palette';
import { EMAIL_COLORS } from './colors';

describe('EMAIL_COLORS', () => {
  // Email clients cannot read the stylesheet, so these are copies. A palette
  // change that forgot them would send mail in the old colours.
  it('copies the light-theme tokens exactly', () => {
    expect(EMAIL_COLORS).toEqual({
      text: token('light', '--foreground'),
      muted: token('light', '--muted-foreground'),
      button: token('light', '--primary'),
      buttonText: token('light', '--primary-foreground'),
    });
  });

  it('keeps the body copy and the button label at AA on a white page', () => {
    expect(contrast(EMAIL_COLORS.muted, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(EMAIL_COLORS.buttonText, EMAIL_COLORS.button)).toBeGreaterThanOrEqual(4.5);
  });
});
