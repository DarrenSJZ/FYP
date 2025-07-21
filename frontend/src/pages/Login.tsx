import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState('');
  const [signUpName, setSignUpName] = useState('');
  
  // Validation errors
  const [signInErrors, setSignInErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [signUpErrors, setSignUpErrors] = useState<{
    email?: string;
    password?: string;
    passwordConfirm?: string;
  }>({});

  // Validation patterns
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  
  // Validation functions
  const validateEmail = (email: string): string | null => {
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address (e.g., user@example.com)';
    }
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!password) return 'Password is required';
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!passwordRegex.test(password)) {
      return 'Password must contain at least: 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (@$!%*?&)';
    }
    return null;
  };

  const validatePasswordConfirm = (password: string, confirmPassword: string): string | null => {
    if (!confirmPassword) return 'Please confirm your password';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Let browser handle required field validation first
    const form = e.target as HTMLFormElement;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    setIsLoading(true);
    setSignInErrors({});

    // Additional custom validation for email format
    const emailError = validateEmail(signInEmail);
    
    if (emailError) {
      setSignInErrors({ 
        email: emailError
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await authService.signIn(signInEmail, signInPassword);
      
      if (error) {
        toast.error(error.message, {
          duration: 30000, // 30 seconds
          dismissible: true,
        });
      } else if (data.user) {
        toast.success('Successfully signed in! Redirecting...', {
          duration: 2000,
        });
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    } catch (err) {
      toast.error('An unexpected error occurred', {
        duration: 30000,
        dismissible: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Let browser handle required field validation first
    const form = e.target as HTMLFormElement;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    setIsLoading(true);
    setSignUpErrors({});

    // Additional custom validation
    const emailError = validateEmail(signUpEmail);
    const passwordError = validatePassword(signUpPassword);
    const passwordConfirmError = validatePasswordConfirm(signUpPassword, signUpPasswordConfirm);

    // If there are validation errors, show them
    if (emailError || passwordError || passwordConfirmError) {
      setSignUpErrors({
        email: emailError || undefined,
        password: passwordError || undefined,
        passwordConfirm: passwordConfirmError || undefined,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await authService.signUp(
        signUpEmail, 
        signUpPassword,
        { full_name: signUpName }
      );
      
      if (error) {
        toast.error(error.message, {
          duration: 30000, // 30 seconds
          dismissible: true,
        });
      } else {
        toast.success('Account created successfully! Check your email to verify.', {
          duration: 5000,
        });
        // Redirect to signup success page
        navigate('/signup-success');
      }
    } catch (err) {
      toast.error('An unexpected error occurred', {
        duration: 30000,
        dismissible: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative">
      {/* Theme Toggle - Floating in top-right */}
      <div className="absolute top-6 right-6">
        <ThemeToggleButton />
      </div>

      {/* Main Content - Vertically centered */}
      <div className="flex flex-col items-center justify-center space-y-8 p-6 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <img 
            src="/favicon.ico" 
            alt="Accentric Logo" 
            className="w-24 h-24"
          />
          <h1 className="text-4xl font-bold text-foreground">Accentric</h1>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to Accentric</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to get started with voice transcription
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>


              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={signInEmail}
                        onChange={(e) => {
                          setSignInEmail(e.target.value);
                          // Clear error when user starts typing
                          if (signInErrors.email) {
                            setSignInErrors(prev => ({ ...prev, email: undefined }));
                          }
                        }}
                        onBlur={(e) => {
                          // Show validation error on blur
                          const emailError = validateEmail(e.target.value);
                          if (emailError) {
                            setSignInErrors(prev => ({ ...prev, email: emailError }));
                          }
                        }}
                        className={`pl-10 ${signInErrors.email ? 'border-red-500' : ''}`}
                        required
                      />
                    </div>
                    {signInErrors.email && (
                      <p className="text-sm text-red-500">{signInErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="Your password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className={`pl-10 ${signInErrors.password ? 'border-red-500' : ''}`}
                        required
                      />
                    </div>
                    {signInErrors.password && (
                      <p className="text-sm text-red-500">{signInErrors.password}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your full name"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={signUpEmail}
                        onChange={(e) => {
                          setSignUpEmail(e.target.value);
                          // Clear error when user starts typing
                          if (signUpErrors.email) {
                            setSignUpErrors(prev => ({ ...prev, email: undefined }));
                          }
                        }}
                        onBlur={(e) => {
                          // Show validation error on blur
                          const emailError = validateEmail(e.target.value);
                          if (emailError) {
                            setSignUpErrors(prev => ({ ...prev, email: emailError }));
                          }
                        }}
                        className={`pl-10 ${signUpErrors.email ? 'border-red-500' : ''}`}
                        required
                      />
                    </div>
                    {signUpErrors.email && (
                      <p className="text-sm text-red-500">{signUpErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Choose a strong password"
                        value={signUpPassword}
                        onChange={(e) => {
                          setSignUpPassword(e.target.value);
                          // Clear error when user starts typing
                          if (signUpErrors.password) {
                            setSignUpErrors(prev => ({ ...prev, password: undefined }));
                          }
                        }}
                        onBlur={(e) => {
                          // Show validation error on blur
                          const passwordError = validatePassword(e.target.value);
                          if (passwordError) {
                            setSignUpErrors(prev => ({ ...prev, password: passwordError }));
                          }
                        }}
                        className={`pl-10 ${signUpErrors.password ? 'border-red-500' : ''}`}
                        required
                        minLength={8}
                      />
                    </div>
                    {signUpErrors.password && (
                      <p className="text-sm text-red-500">{signUpErrors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password-confirm"
                        type="password"
                        placeholder="Re-enter your password"
                        value={signUpPasswordConfirm}
                        onChange={(e) => {
                          setSignUpPasswordConfirm(e.target.value);
                          // Clear error when user starts typing
                          if (signUpErrors.passwordConfirm) {
                            setSignUpErrors(prev => ({ ...prev, passwordConfirm: undefined }));
                          }
                        }}
                        onBlur={(e) => {
                          // Show validation error on blur
                          const passwordConfirmError = validatePasswordConfirm(signUpPassword, e.target.value);
                          if (passwordConfirmError) {
                            setSignUpErrors(prev => ({ ...prev, passwordConfirm: passwordConfirmError }));
                          }
                        }}
                        className={`pl-10 ${signUpErrors.passwordConfirm ? 'border-red-500' : ''}`}
                        required
                        minLength={8}
                      />
                    </div>
                    {signUpErrors.passwordConfirm && (
                      <p className="text-sm text-red-500">{signUpErrors.passwordConfirm}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;