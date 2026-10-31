import {registerActivityCleanup} from './activity-store.js';
import { registerSearch } from './search-controller.js';
import { mountPalette } from './palette.js';
registerSearch(chrome, mountPalette);

registerActivityCleanup(chrome);
