/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                nova: {
                    bg:           '#020617',
                    surface:      '#0f172a',
                    'surface-2':  '#1e293b',
                    border:       '#334155',
                    'border-2':   '#475569',
                    text:         '#ffffff',
                    'text-2':     '#f8fafc',
                    muted:        '#f1f5f9',
                    dim:          '#e2e8f0',
                    accent:       '#22d3ee',
                    'accent-dim': '#06b6d4',
                    'accent-dark': '#0891b2',
                },
            },
            screens: {
                xs: '475px',
            },
            fontFamily: {
                sans: ['Outfit', 'system-ui', 'sans-serif'],
            },
            animation: {
                pulse: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow-pulse': 'glow 3s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 5px rgba(34, 211, 238, 0.2)' },
                    '100%': { boxShadow: '0 0 20px rgba(34, 211, 238, 0.6)' }
                }
            },
            backgroundImage: {
                'grid-pattern':
                    'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
                'grid-pattern-light':
                    'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)',
                'space-gradient': 'linear-gradient(to bottom right, #020617, #0f172a, #1e1b4b)',
            },
            backgroundSize: {
                grid: '20px 20px',
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
};
