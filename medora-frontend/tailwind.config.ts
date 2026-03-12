import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                medora: {
                    light: "#fde6ef",
                    primary: "#f8c8dc",
                    dark: "#d46a92",
                    accent: "#ff6fa5",
                },
            },
        },
    },
    plugins: [],
};

export default config;