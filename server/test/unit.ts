// Running directly also avoids Node 26's test-isolation issue with synchronous TypeScript suites.
import './rules.test.js';
import './crypto.test.js';
import './badges.test.js';
import './names.test.js';
import './username.test.js';
