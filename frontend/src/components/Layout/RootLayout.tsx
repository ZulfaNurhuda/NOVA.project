import { Outlet } from 'react-router-dom';
import { Footer } from '../Footer';
import { Header } from '../Header';

export function RootLayout() {
    return (
        <div className="flex flex-col min-h-screen bg-nova-text-2 dark:bg-nova-space-gradient text-gray-900 dark:text-white">
            <Header />
            <main className="flex-grow w-full max-w-4xl mx-auto px-4">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
