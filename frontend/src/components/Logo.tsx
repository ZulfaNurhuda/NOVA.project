const Logo = ({ className, ...rest }: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...rest}
    >
        <path d="M256 64 l51.2 162.1 162.1 51.2 -162.1 51.2 -51.2 162.1 -51.2 -162.1 -162.1 -51.2 162.1 -51.2 z" />
    </svg>
);

export default Logo;
