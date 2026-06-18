import {
    BarChart3,
    Link2,
    LogOut,
    Menu,
    Server,
    Shield,
    Ticket,
    User,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { authClient } from '../../lib/auth';
import { useNOVAStore } from '../../store/novaStore';
import { useUserStore } from '../../store/userStore';
import Logo from '../Logo';

export function DashboardLayout() {
    const { t } = useTranslation();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, isLoading } = useUserStore();
    const { settings } = useNOVAStore();

    const handleLogout = async () => {
        await authClient.signOut();
        window.location.href = '/login';
    };

    const navigation = [
        { name: t('dashboard_layout.secrets'), href: '/dashboard', icon: Shield },
        {
            name: t('dashboard_layout.secret_requests'),
            href: '/dashboard/secret-requests',
            icon: Link2,
        },
        { name: t('dashboard_layout.account'), href: '/dashboard/account', icon: User },
        ...(user?.isAdmin
            ? [
                  {
                      name: t('dashboard_layout.analytics'),
                      href: '/dashboard/analytics',
                      icon: BarChart3,
                  },
                  { name: t('dashboard_layout.users'), href: '/dashboard/users', icon: Users },
                  ...(settings.requireInviteCode
                      ? [
                            {
                                name: t('dashboard_layout.invites'),
                                href: '/dashboard/invites',
                                icon: Ticket,
                            },
                        ]
                      : []),
                  {
                      name: t('dashboard_layout.instance'),
                      href: '/dashboard/instance',
                      icon: Server,
                  },
              ]
            : []),
    ];

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return location.pathname === '/dashboard';
        }
        return location.pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-nova-text-2 dark:bg-nova-space-gradient">
            <div className="relative">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

                {/* Mobile menu overlay */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div
                            className="fixed inset-0 bg-nova-text-2/90 dark:bg-nova-bg/90 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-nova-surface border-r border-gray-200 dark:border-nova-border z-50">
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-nova-border">
                                <Link
                                    to="/"
                                    className="flex items-center gap-2 text-gray-900 dark:text-white"
                                >
                                    <Logo className="w-5 h-5 sm:w-6 sm:h-6 fill-gray-900 dark:fill-white" />
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-xl font-bold">{t('dashboard_layout.nova')}</span>
                                        <span className="text-[9px] tracking-[0.22em] uppercase font-semibold text-nova-accent opacity-60">by AEGIS</span>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <nav className="p-4 space-y-2">
                                {navigation.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`flex items-center space-x-3 px-3 py-2 transition-all duration-200 ${
                                                isActive(item.href)
                                                    ? 'bg-nova-accent/20 text-nova-accent border border-nova-accent-dim/30'
                                                    : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-nova-border'
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center space-x-3 px-3 py-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-nova-border w-full"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span>{t('dashboard_layout.sign_out')}</span>
                                </button>
                            </nav>
                        </div>
                    </div>
                )}

                <div className="flex">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0">
                        <div className="flex flex-col flex-1 bg-white dark:bg-nova-surface border-r border-gray-200 dark:border-nova-border">
                            {/* Logo */}
                            <div className="flex items-center px-4 py-4 border-b border-gray-200 dark:border-nova-border">
                                <Link
                                    to="/"
                                    className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-nova-accent-dim dark:hover:text-nova-accent transition-colors"
                                >
                                    <Logo className="w-5 h-5 fill-gray-900 dark:fill-white" />
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-lg font-bold">NOVA</span>
                                        <span className="text-[9px] tracking-[0.22em] uppercase font-semibold text-nova-accent opacity-60">by AEGIS</span>
                                    </div>
                                </Link>
                            </div>

                            {/* Navigation */}
                            <nav className="flex-1 px-3 py-4 space-y-1">
                                {navigation.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            className={`flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors ${
                                                isActive(item.href)
                                                    ? 'bg-nova-accent/10 text-nova-accent-dark dark:text-nova-accent border-l-2 border-nova-accent-dim -ml-[2px] pl-[12px]'
                                                    : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-nova-surface-2/50'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="font-medium text-xs">{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* User info */}
                            <div className="px-3 py-3 border-t border-gray-200 dark:border-nova-border">
                                <Link
                                    to="/dashboard/account"
                                    className="flex items-center gap-2.5 px-2.5 py-2 bg-gray-50 dark:bg-nova-surface-2/30 border border-gray-100 dark:border-nova-border/50 hover:bg-gray-100 dark:hover:bg-nova-surface-2/50 transition-colors overflow-hidden"
                                >
                                    <div className="w-8 h-8 bg-nova-accent flex items-center justify-center shrink-0">
                                        <User className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        {isLoading ? (
                                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                                {t('common.loading')}
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                                    {user?.username}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                                    {user?.email}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 w-full px-2.5 py-2 mt-2 text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">
                                        {t('dashboard_layout.sign_out')}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 lg:pl-64">
                        {/* Mobile header */}
                        <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between p-4 bg-white dark:bg-nova-surface border-b border-gray-200 dark:border-nova-border">
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                                aria-label="Open menu"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <Link
                                to="/"
                                className="flex items-center space-x-2 text-gray-900 dark:text-white"
                            >
                                <Logo className="w-5 h-5 sm:w-6 sm:h-6 fill-gray-900 dark:fill-white" />
                                <span className="text-xl font-bold">NOVA</span>
                            </Link>
                        </div>

                        {/* Page content */}
                        <main className="relative">
                            <Outlet />
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}
