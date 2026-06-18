import { Lock } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthPageLayout } from '../components/AuthPageLayout';
import { Card } from '../components/Card';
import { FormField } from '../components/FormField';
import { LoadingButton } from '../components/LoadingButton';
import { PasswordToggle } from '../components/PasswordToggle';
import { useErrorModal } from '../hooks/useModalState';
import { authClient } from '../lib/auth';

export function ResetPasswordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const errorModal = useErrorModal();

    if (!token) {
        return (
            <AuthPageLayout
                title="Invalid Link"
                subtitle="This password reset link is invalid or has expired."
                backTo="/forgot-password"
                backLabel="Request a new link"
                errorModal={errorModal}
            >
                <Card className="text-center p-8">
                    <p className="text-gray-600 dark:text-slate-300">
                        Please request a new password reset link.
                    </p>
                </Card>
            </AuthPageLayout>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.password !== formData.confirmPassword) {
            errorModal.showError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await authClient.resetPassword({
                newPassword: formData.password,
                token,
            });

            if (error) {
                errorModal.showError(`Failed to reset password: ${error.message}`);
            } else {
                // Login automatically or redirect to login
                navigate('/login', { replace: true });
            }
        } catch (error) {
            console.error('An error occurred:', error);
            errorModal.showError(t('login_page.unexpected_error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthPageLayout
            title="Create New Password"
            subtitle="Enter your new password below"
            backTo="/login"
            backLabel="Back to sign in"
            errorModal={errorModal}
        >
            <Card noPadding className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <FormField
                        label="New Password"
                        icon={Lock}
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(value) => setFormData((prev) => ({ ...prev, password: value }))}
                        placeholder="Enter your new password"
                        required
                        rightElement={
                            <PasswordToggle
                                visible={showPassword}
                                onToggle={() => setShowPassword(!showPassword)}
                            />
                        }
                    />
                    
                    <FormField
                        label="Confirm New Password"
                        icon={Lock}
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(value) => setFormData((prev) => ({ ...prev, confirmPassword: value }))}
                        placeholder="Confirm your new password"
                        required
                    />

                    <LoadingButton
                        isLoading={isLoading}
                        loadingText="Resetting..."
                    >
                        <span>Reset Password</span>
                    </LoadingButton>
                </form>
            </Card>
        </AuthPageLayout>
    );
}
