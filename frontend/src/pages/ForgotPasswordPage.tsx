import { Mail } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPageLayout } from '../components/AuthPageLayout';
import { Card } from '../components/Card';
import { FormField } from '../components/FormField';
import { LoadingButton } from '../components/LoadingButton';
import { useErrorModal } from '../hooks/useModalState';
import { authClient } from '../lib/auth';

export function ForgotPasswordPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const errorModal = useErrorModal();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await authClient.requestPasswordReset({
                email,
                redirectTo: '/reset-password',
            });

            if (error) {
                errorModal.showError(error.message);
            } else {
                setIsSuccess(true);
            }
        } catch (error) {
            console.error('An error occurred:', error);
            errorModal.showError(t('login_page.unexpected_error'));
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <AuthPageLayout
                title="Check your email"
                subtitle="We've sent a password reset link"
                backTo="/login"
                backLabel="Back to sign in"
                errorModal={errorModal}
            >
                <Card className="text-center p-8">
                    <div className="w-16 h-16 bg-nova-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-8 h-8 text-nova-accent-dim" />
                    </div>
                    <p className="text-gray-600 dark:text-slate-300 mb-6">
                        We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and spam folder.
                    </p>
                    <button
                        onClick={() => setIsSuccess(false)}
                        className="text-nova-accent-dim hover:text-nova-accent text-sm font-medium transition-colors"
                    >
                        Try another email address
                    </button>
                </Card>
            </AuthPageLayout>
        );
    }

    return (
        <AuthPageLayout
            title="Reset Password"
            subtitle="Enter your email to receive a reset link"
            backTo="/login"
            backLabel="Back to sign in"
            errorModal={errorModal}
        >
            <Card noPadding className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <FormField
                        label="Email Address"
                        icon={Mail}
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="Enter your registered email"
                        required
                    />

                    <LoadingButton
                        isLoading={isLoading}
                        loadingText="Sending link..."
                    >
                        <span>Send Reset Link</span>
                    </LoadingButton>
                </form>
            </Card>
        </AuthPageLayout>
    );
}
