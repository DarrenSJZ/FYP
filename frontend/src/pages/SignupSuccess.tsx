import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { CheckCircle, Mail, ArrowRight } from 'lucide-react';

export default function SignupSuccess() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const handleContinue = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Theme Toggle - Floating in top-right */}
      <div className="absolute top-6 right-6">
        <ThemeToggleButton />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-400">
            Account Created Successfully!
          </CardTitle>
          <CardDescription className="text-center">
            Welcome to Accentric Voice
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg border">
            <div className="flex items-start space-x-3">
              <Mail className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Check Your Email</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We've sent a confirmation email to your inbox. Please click the link to verify your account and complete the signup process.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-foreground">What's Next?</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Check your email (including spam folder)</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Click the verification link</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Return to Accentric Voice and sign in</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Start contributing to speech recognition research</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <Button 
              onClick={handleContinue}
              className="w-full"
              variant="default"
            >
              Continue to Accentric Voice
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-2">
              Automatically redirecting in {countdown} seconds
            </p>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Didn't receive the email?{' '}
              <button 
                className="text-primary hover:text-primary/80 underline"
                onClick={() => {
                  // You can implement resend functionality here if needed
                  alert('Please check your spam folder or contact support');
                }}
              >
                Need help?
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}