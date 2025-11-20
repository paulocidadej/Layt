import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'maritime-gradient': 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #14b8a6 100%)',
        'ocean-wave': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(59, 130, 246, 0.03) 10px, rgba(59, 130, 246, 0.03) 20px)',
      },
      colors: {
        'ocean': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        'teal': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
  		background: 'hsl(var(--background))',
  		foreground: 'hsl(var(--foreground))',
  		card: {
  			DEFAULT: 'hsl(var(--card))',
  			foreground: 'hsl(var(--card-foreground))'
  		},
  		popover: {
  			DEFAULT: 'hsl(var(--popover))',
  			foreground: 'hsl(var(--popover-foreground))'
  		},
  		primary: {
  			DEFAULT: 'hsl(var(--primary))',
  			foreground: 'hsl(var(--primary-foreground))'
  		},
  		secondary: {
  			DEFAULT: 'hsl(var(--secondary))',
  			foreground: 'hsl(var(--secondary-foreground))'
  		},
  		muted: {
  			DEFAULT: 'hsl(var(--muted))',
  			foreground: 'hsl(var(--muted-foreground))'
  		},
  		accent: {
  			DEFAULT: 'hsl(var(--accent))',
  			foreground: 'hsl(var(--accent-foreground))'
  		},
  		destructive: {
  			DEFAULT: 'hsl(var(--destructive))',
  			foreground: 'hsl(var(--destructive-foreground))'
  		},
  		border: 'hsl(var(--border))',
  		input: 'hsl(var(--input))',
  		ring: 'hsl(var(--ring))',
  		chart: {
  			'1': 'hsl(var(--chart-1))',
  			'2': 'hsl(var(--chart-2))',
  			'3': 'hsl(var(--chart-3))',
  			'4': 'hsl(var(--chart-4))',
  			'5': 'hsl(var(--chart-5))'
  		}
  	},
  	borderRadius: {
  		lg: 'var(--radius)',
  		md: 'calc(var(--radius) - 2px)',
  		sm: 'calc(var(--radius) - 4px)'
  	},
  	boxShadow: {
  		'maritime': '0 10px 40px -10px rgba(14, 165, 233, 0.3)',
  		'maritime-lg': '0 20px 60px -15px rgba(14, 165, 233, 0.4)',
  	},
  	animation: {
  		'shimmer': 'shimmer 3s infinite',
  		'wave': 'wave 3s ease-in-out infinite',
  	},
  	keyframes: {
  		shimmer: {
  			'0%': { transform: 'translateX(-100%)' },
  			'100%': { transform: 'translateX(100%)' },
  		},
  		wave: {
  			'0%, 100%': { transform: 'translateY(0)' },
  			'50%': { transform: 'translateY(-10px)' },
  		},
  	},
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
