import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // APEX Pulse™ brand tokens
        primary:   '#185FA5',
        action:    '#378ADD',
        accent:    '#85B7EB',
        deep:      '#042C53',
        'deep-mid':'#0C447C',
        // Semantic dark-theme layer
        bg:        '#071E3D',
        panel:     '#0D2845',
        panel2:    '#0F3058',
        line:      'rgba(133,183,235,0.13)',
        txt:       '#EBF4FF',
        muted:     '#85B7EB',
        dim:       'rgba(133,183,235,0.40)',
        // Status / chart
        cyan:      '#378ADD',
        blue:      '#85B7EB',
        violet:    '#7B96C9',
        green:     '#22A06B',
        amber:     '#C98A20',
        rose:      '#E24B4A',
        orange:    '#D97332',
        pink:      '#B06BAA',
        sky:       '#5AADDC',
        lime:      '#3BA868',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      keyframes: {
        pulse2:    { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        fadeIn:    { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(55,138,221,0.30)' },
          '50%':       { boxShadow: '0 0 20px rgba(55,138,221,0.60)' },
        },
      },
      animation: {
        pulse2:    'pulse2 2.2s ease-in-out infinite',
        fadeIn:    'fadeIn 0.35s ease',
        slideUp:   'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        glowPulse: 'glowPulse 2.5s ease-in-out infinite',
      },
      backdropBlur: { xs: '4px', sm: '8px', md: '14px', lg: '20px' },
    },
  },
  plugins: [],
}

export default config
