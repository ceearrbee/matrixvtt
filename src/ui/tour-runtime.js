/**
 * Lazily imported tour runtime: driver.js plus both stylesheets.
 * Kept in one module so the vendor CSS and the theming overrides land
 * in the same lazy chunk in this order - the override layer depends
 * on loading after the vendor rules.
 */
import 'driver.js/dist/driver.css';
import './onboarding-tour.css';

export { driver } from 'driver.js';
