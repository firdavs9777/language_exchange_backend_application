const test = require('node:test');
const assert = require('node:assert/strict');

// Google mints an ID token audienced to the OAuth client that performed the
// sign-in — the iOS client on iOS, the Android client on Android. The Flutter
// `serverClientId` option does NOT retarget the audience on iOS (verified
// against a real device: aud came back as the iOS client, and serverAuthCode
// was null). So verification must accept every client ID we own, not one.

const GAL = require.resolve('google-auth-library');
const SV = require.resolve('../utils/socialVerify');

/** Loads socialVerify with google-auth-library stubbed out. */
function loadWithStub({ clientId, onVerify }) {
  const realGal = require.cache[GAL];
  require.cache[GAL] = {
    id: GAL,
    filename: GAL,
    loaded: true,
    exports: {
      OAuth2Client: class {
        constructor(id) {
          this.id = id;
        }
        async verifyIdToken(opts) {
          return onVerify(opts);
        }
      },
    },
  };
  delete require.cache[SV];
  process.env.FLAME_GOOGLE_CLIENT_ID = clientId;
  const sv = require(SV);
  return {
    sv,
    restore() {
      if (realGal) require.cache[GAL] = realGal;
      else delete require.cache[GAL];
      delete require.cache[SV];
      delete process.env.FLAME_GOOGLE_CLIENT_ID;
    },
  };
}

const WEB = '55426082662-web.apps.googleusercontent.com';
const IOS = '55426082662-ios.apps.googleusercontent.com';

test('verifyGoogle passes EVERY configured client ID as the audience', async () => {
  let seen;
  const { sv, restore } = loadWithStub({
    clientId: `${WEB},${IOS}`,
    onVerify: (opts) => {
      seen = opts;
      return { getPayload: () => ({ sub: 'u1', email: 'a@b.c' }) };
    },
  });

  try {
    await sv.verifyGoogle('token');
    assert.deepEqual(
      seen.audience,
      [WEB, IOS],
      'audience must be the full list so an iOS-audienced token verifies',
    );
  } finally {
    restore();
  }
});

test('a token audienced to the iOS client verifies when that client is listed', async () => {
  const { sv, restore } = loadWithStub({
    clientId: `${WEB},${IOS}`,
    // Emulate google-auth-library: reject unless aud is among the audiences.
    onVerify: ({ audience }) => {
      const allowed = Array.isArray(audience) ? audience : [audience];
      if (!allowed.includes(IOS)) throw new Error('Wrong recipient');
      return { getPayload: () => ({ sub: 'ios-user', email: 'i@b.c' }) };
    },
  });

  try {
    const p = await sv.verifyGoogle('token');
    assert.equal(p.providerId, 'ios-user');
  } finally {
    restore();
  }
});

test('whitespace and trailing commas in the env var are tolerated', async () => {
  let seen;
  const { sv, restore } = loadWithStub({
    clientId: `  ${WEB} , ${IOS} , `,
    onVerify: (opts) => {
      seen = opts;
      return { getPayload: () => ({ sub: 'u1' }) };
    },
  });

  try {
    await sv.verifyGoogle('token');
    assert.deepEqual(seen.audience, [WEB, IOS]);
  } finally {
    restore();
  }
});

test('a single client ID still works and is passed as a one-element list', async () => {
  let seen;
  const { sv, restore } = loadWithStub({
    clientId: WEB,
    onVerify: (opts) => {
      seen = opts;
      return { getPayload: () => ({ sub: 'u1' }) };
    },
  });

  try {
    await sv.verifyGoogle('token');
    assert.deepEqual(seen.audience, [WEB]);
  } finally {
    restore();
  }
});

test('isConfigured stays true for a list and false when unset', () => {
  const { sv, restore } = loadWithStub({
    clientId: `${WEB},${IOS}`,
    onVerify: () => ({ getPayload: () => ({}) }),
  });
  try {
    assert.equal(sv.isConfigured('google'), true);
    delete process.env.FLAME_GOOGLE_CLIENT_ID;
    assert.equal(sv.isConfigured('google'), false);
  } finally {
    restore();
  }
});
