import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  CalendarDays, 
  Eye, 
  FileAudio, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  PlayCircle
} from 'lucide-react';

interface UserContribution {
  id: string;
  audio_url: string;
  original_filename: string;
  file_size_bytes: number;
  file_mime_type: string;
  sentence: string;
  transcription_results: any;
  validation_status: 'pending' | 'validated' | 'rejected';
  accent_detected: string;
  locale_detected: string;
  moderator_notes?: string;
  created_at: string;
  updated_at: string;
  moderated_at?: string;
}

export function UserHistory() {
  const [contributions, setContributions] = useState<UserContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContribution, setSelectedContribution] = useState<UserContribution | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserContributions();
  }, []);

  const fetchUserContributions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('You must be logged in to view your history');
        return;
      }

      // Fetch user's contributions
      const { data, error } = await supabase
        .from('user_contributions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setContributions(data || []);
    } catch (error) {
      console.error('Error fetching contributions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      validated: 'default',
      rejected: 'destructive',
      pending: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your contribution history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={fetchUserContributions} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Contribution History</h2>
          <p className="text-muted-foreground">
            Track your audio uploads and their validation status
          </p>
        </div>
        <Button onClick={fetchUserContributions} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contributions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Validated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {contributions.filter(c => c.validation_status === 'validated').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {contributions.filter(c => c.validation_status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contributions Table */}
      {contributions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <FileAudio className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-semibold">No contributions yet</h3>
                <p className="text-muted-foreground">
                  Start by uploading your first audio file using the Upload mode
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Contributions</CardTitle>
            <CardDescription>
              Your uploaded audio files and their processing status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Transcription</TableHead>
                  <TableHead>Accent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributions.map((contribution) => (
                  <TableRow key={contribution.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{contribution.original_filename}</div>
                        <div className="text-sm text-muted-foreground">
                          {contribution.session_type === 'practice' ? 'Practice Mode' : formatFileSize(contribution.file_size_bytes)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {contribution.sentence || 'No transcription'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{contribution.accent_detected}</div>
                        <div className="text-xs text-muted-foreground">
                          {contribution.locale_detected}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(contribution.validation_status)}
                        {getStatusBadge(contribution.validation_status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(contribution.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedContribution(contribution)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Contribution Details</DialogTitle>
                              <DialogDescription>
                                Full details for {contribution.original_filename}
                              </DialogDescription>
                            </DialogHeader>
                            {selectedContribution && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <strong>Status:</strong> {selectedContribution.validation_status}
                                  </div>
                                  <div>
                                    <strong>Created:</strong> {formatDate(selectedContribution.created_at)}
                                  </div>
                                  <div>
                                    <strong>Accent:</strong> {selectedContribution.accent_detected}
                                  </div>
                                  <div>
                                    <strong>Locale:</strong> {selectedContribution.locale_detected}
                                  </div>
                                </div>
                                <div>
                                  <strong>Transcription:</strong>
                                  <p className="mt-1 p-2 bg-muted rounded text-sm break-words">
                                    {selectedContribution.sentence}
                                  </p>
                                </div>
                                {selectedContribution.moderator_notes && (
                                  <div>
                                    <strong>Moderator Notes:</strong>
                                    <p className="mt-1 p-2 bg-muted rounded text-sm break-words">
                                      {selectedContribution.moderator_notes}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <strong>Full Results:</strong>
                                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words max-w-full">
                                    {JSON.stringify(selectedContribution.transcription_results, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(contribution.audio_url, '_blank')}
                        >
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}