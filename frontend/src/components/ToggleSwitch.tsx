interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            className={`
    relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-nova-accent/30 focus:ring-offset-2 focus:ring-offset-white dark:ring-offset-nova-surface touch-manipulation
    ${checked ? 'bg-nova-accent' : 'bg-gray-300 dark:bg-nova-border'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
   `}
            disabled={disabled}
        >
            <span
                className={`
     inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-lg
     ${checked ? 'translate-x-6' : 'translate-x-1'}
    `}
            />
        </button>
    );
}
