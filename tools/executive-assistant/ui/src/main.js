import './style.css';
import { AdminDashboard } from './components/AdminDashboard.js';

// Register the custom element so it acts as an embeddable modular tag
if (!customElements.get('noemi-ea-admin')) {
  customElements.define('noemi-ea-admin', AdminDashboard);
}
