import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle, XCircle, RefreshCw, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { dockerAPI } from "@/lib/api";

interface HealthData {
  status: string;
  healthy_services: number;
  total_services: number;
  services: Record<string, boolean>;
}

interface ServiceStatus {
  orchestrator: {
    status: 'connected' | 'disconnected' | 'checking';
    data: HealthData | null;
    error: string | null;
  };
  autocomplete: {
    status: 'connected' | 'disconnected' | 'checking';
    data: { status: string; service: string; timestamp: string } | null;
    error: string | null;
  };
}

export function DockerStatus() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    orchestrator: { status: 'disconnected', data: null, error: null },
    autocomplete: { status: 'disconnected', data: null, error: null },
  });

  const checkConnection = async () => {
    setIsChecking(true);
    setServiceStatus({
      orchestrator: { status: 'checking', data: null, error: null },
      autocomplete: { status: 'checking', data: null, error: null },
    });

    try {
      const results = await dockerAPI.checkAllServices();
      setServiceStatus(results);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to check Docker services:', error);
      setServiceStatus({
        orchestrator: { status: 'disconnected', data: null, error: 'Connection failed' },
        autocomplete: { status: 'disconnected', data: null, error: 'Connection failed' },
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const getOverallStatus = () => {
    if (isChecking) return 'checking';
    if (serviceStatus.orchestrator.status === 'connected') return 'connected';
    if (serviceStatus.orchestrator.status === 'connected' || serviceStatus.autocomplete.status === 'connected') return 'partial';
    return 'disconnected';
  };

  const getMainIcon = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'partial':
        return 'Partial';
      case 'checking':
        return 'Checking';
      default:
        return 'Offline';
    }
  };

  const getStatusIcon = (status: 'connected' | 'disconnected' | 'checking') => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" style={{ color: 'hsl(var(--sage-green))' }} />;
      case 'disconnected':
        return <XCircle className="h-4 w-4" style={{ color: 'hsl(var(--destructive))' }} />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />;
    }
  };

  const getStatusBadge = (status: 'connected' | 'disconnected' | 'checking') => {
    switch (status) {
      case 'connected':
        return (
          <Badge 
            className="text-white" 
            style={{ backgroundColor: 'hsl(var(--sage-green))' }}
          >
            Connected
          </Badge>
        );
      case 'disconnected':
        return <Badge variant="destructive">Disconnected</Badge>;
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {getMainIcon()}
          {getStatusText()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Service Status
              <Button
                variant="ghost"
                size="sm"
                onClick={checkConnection}
                disabled={isChecking}
                className="h-6 px-2"
              >
                <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              ASR and autocomplete service connectivity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Orchestrator Service */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(serviceStatus.orchestrator.status)}
                <div>
                  <p className="font-medium">ASR Orchestrator</p>
                  <p className="text-sm text-muted-foreground">Port 8000</p>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(serviceStatus.orchestrator.status)}
                {serviceStatus.orchestrator.data && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {serviceStatus.orchestrator.data.healthy_services}/{serviceStatus.orchestrator.data.total_services} ASR models
                  </p>
                )}
              </div>
            </div>

            {/* Autocomplete Service */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(serviceStatus.autocomplete.status)}
                <div>
                  <p className="font-medium">Autocomplete Service</p>
                  <p className="text-sm text-muted-foreground">Port 8007</p>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(serviceStatus.autocomplete.status)}
              </div>
            </div>

            {/* Overall Status */}
            {lastChecked && (
              <div className="text-center pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
                {serviceStatus.orchestrator.status === 'connected' ? (
                  <p className="text-sm font-medium mt-1" style={{ color: 'hsl(var(--sage-green))' }}>
                    ✅ Ready for transcription
                  </p>
                ) : (
                  <p className="text-sm font-medium mt-1" style={{ color: 'hsl(var(--destructive))' }}>
                    ❌ Services not available
                  </p>
                )}
              </div>
            )}

            {/* Error Messages */}
            {(serviceStatus.orchestrator.error || serviceStatus.autocomplete.error) && (
              <div 
                className="text-sm p-3 rounded-lg border"
                style={{ 
                  color: 'hsl(var(--destructive))',
                  backgroundColor: 'hsl(var(--destructive) / 0.1)',
                  borderColor: 'hsl(var(--destructive) / 0.3)'
                }}
              >
                <p className="font-medium mb-1">Connection Errors:</p>
                {serviceStatus.orchestrator.error && (
                  <p>• Orchestrator: {serviceStatus.orchestrator.error}</p>
                )}
                {serviceStatus.autocomplete.error && (
                  <p>• Autocomplete: {serviceStatus.autocomplete.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}