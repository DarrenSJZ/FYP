import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, RefreshCw, AlertCircle, Loader2, Play, AlertTriangle } from "lucide-react";
import { dockerAPI } from "@/lib/api";

interface HealthData {
  status: string;
  healthy_services: number;
  total_services: number;
  services: Record<string, boolean>;
}

interface DockerLoadingDialogProps {
  isOpen: boolean;
  onServicesReady: () => void;
  onProceedAnyway: () => void;
}

export function DockerLoadingDialog({ isOpen, onServicesReady, onProceedAnyway }: DockerLoadingDialogProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);

  const checkDockerServices = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const results = await dockerAPI.checkAllServices();
      
      if (results.orchestrator.status === 'connected' && results.orchestrator.data) {
        setHealthData(results.orchestrator.data);
        
        // Check if all services are ready
        if (results.orchestrator.data.status === 'healthy' && 
            results.orchestrator.data.healthy_services === results.orchestrator.data.total_services) {
          // All services are ready, auto-close dialog
          onServicesReady();
          return;
        }
      } else {
        setError(results.orchestrator.error || 'Could not connect to Docker services');
      }
    } catch (err) {
      setError('Failed to check Docker services status');
      console.error('Docker service check failed:', err);
    } finally {
      setIsChecking(false);
      setCheckAttempt(prev => prev + 1);
    }
  };

  // Check services every 3 seconds when dialog is open
  useEffect(() => {
    if (!isOpen) return;

    checkDockerServices();
    const interval = setInterval(checkDockerServices, 3000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const getProgressPercentage = () => {
    if (!healthData) return 0;
    return Math.round((healthData.healthy_services / healthData.total_services) * 100);
  };

  const getServicesList = () => {
    if (!healthData?.services) return null;

    return Object.entries(healthData.services).map(([serviceName, isHealthy]) => (
      <div key={serviceName} className="flex items-center gap-2 text-sm">
        {isHealthy ? (
          <CheckCircle className="h-4 w-4 text-[hsl(var(--sage-green))]" />
        ) : (
          <Loader2 className="h-4 w-4 text-[hsl(var(--accent))] animate-spin" />
        )}
        <span className={isHealthy ? "text-[hsl(var(--sage-green))]" : "text-muted-foreground"}>
          {serviceName}
        </span>
        {isHealthy && <span className="text-xs text-[hsl(var(--sage-green))]">Ready</span>}
      </div>
    ));
  };

  const allServicesReady = healthData?.status === 'healthy' && 
                           healthData?.healthy_services === healthData?.total_services;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allServicesReady ? (
              <CheckCircle className="h-5 w-5 text-[hsl(var(--sage-green))]" />
            ) : (
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            )}
            {allServicesReady ? 'ASR Models Ready' : 'Starting ASR Models'}
          </DialogTitle>
          <DialogDescription>
            {allServicesReady 
              ? "All speech recognition models are now ready for use."
              : "Speech recognition models are initializing. You can wait for full functionality or proceed with limited features."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Services Status</span>
                  <span>
                    {healthData ? `${healthData.healthy_services}/${healthData.total_services}` : '0/0'}
                  </span>
                </div>
                <Progress value={getProgressPercentage()} className="w-full" />
              </div>

              {/* Services List */}
              {healthData?.services && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  <h4 className="text-sm font-medium">Service Status:</h4>
                  <div className="grid gap-1">
                    {getServicesList()}
                  </div>
                </div>
              )}

              {/* Warning for proceeding anyway */}
              {!allServicesReady && (
                <div className="flex items-start gap-2 p-3 bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-[hsl(var(--accent))] mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-[hsl(var(--accent))]">
                    <p className="font-medium mb-1">Proceeding early may result in:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>Transcription failures or errors</li>
                      <li>Reduced ASR model accuracy</li>
                      <li>Processing timeouts</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {allServicesReady ? (
              <Button onClick={onServicesReady} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Launch Application
              </Button>
            ) : (
              <>
                <Button 
                  onClick={onServicesReady} 
                  disabled={isChecking}
                  className="w-full"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Waiting for Services...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Wait for Full Functionality
                    </>
                  )}
                </Button>
                <Button 
                  onClick={onProceedAnyway}
                  variant="outline"
                  className="w-full border-[hsl(var(--accent))] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Proceed Anyway
                </Button>
              </>
            )}
          </div>

          {/* Status Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Models typically take 2-3 minutes to fully load</p>
            <p>• Full functionality includes all ASR models and features</p>
            {error && (
              <Button 
                onClick={checkDockerServices} 
                disabled={isChecking}
                size="sm"
                variant="ghost"
                className="w-full mt-2"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Retry Connection
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}