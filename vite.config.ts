import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: set to your exact repo name between slashes
  // Example: '/Luis-Josh/'
  base: "/Luis-Josh/"
});
