// This file re-exports the useAuth hook for cleaner imports in consumer components.
// The actual context logic and hook implementation are in '../context/AuthContext'.
import { useAuth } from '../context/AuthContext';

export { useAuth };