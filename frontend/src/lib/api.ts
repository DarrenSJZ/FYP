interface HealthStatus {
  status: string;
  healthy_services: number;
  total_services: number;
  services: Record<string, boolean>;
}

interface AutocompleteHealth {
  status: string;
  service: string;
  timestamp: string;
}

interface RandomClip {
  clip_id: string;
  sentence: string;
  audio_url: string;
  gcs_object_path_in_bucket: string;
}

export class DockerAPI {
  private baseUrl: string;
  private autocompleteUrl: string;
  private backendUrl: string;

  constructor() {
    // Default to localhost, but these could be environment variables
    this.baseUrl = 'http://localhost:8000';
    this.autocompleteUrl = 'http://localhost:8007';
    this.backendUrl = 'http://localhost:8080'; // FastAPI backend service
  }

  async checkOrchestratorHealth(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Orchestrator health check failed: ${response.status}`);
    }

    return response.json();
  }

  async checkAutocompleteHealth(): Promise<AutocompleteHealth> {
    const response = await fetch(`${this.autocompleteUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Autocomplete health check failed: ${response.status}`);
    }

    return response.json();
  }

  async checkAllServices() {
    try {
      const [orchestratorHealth, autocompleteHealth] = await Promise.allSettled([
        this.checkOrchestratorHealth(),
        this.checkAutocompleteHealth(),
      ]);

      return {
        orchestrator: {
          status: orchestratorHealth.status === 'fulfilled' ? 'connected' : 'disconnected',
          data: orchestratorHealth.status === 'fulfilled' ? orchestratorHealth.value : null,
          error: orchestratorHealth.status === 'rejected' ? orchestratorHealth.reason.message : null,
        },
        autocomplete: {
          status: autocompleteHealth.status === 'fulfilled' ? 'connected' : 'disconnected',
          data: autocompleteHealth.status === 'fulfilled' ? autocompleteHealth.value : null,
          error: autocompleteHealth.status === 'rejected' ? autocompleteHealth.reason.message : null,
        },
      };
    } catch (error) {
      throw new Error(`Failed to check services: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listAvailableModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    return response.json();
  }

  async transcribeAudio(file: File, models?: string[]) {
    const formData = new FormData();
    formData.append('file', file);
    if (models) {
      formData.append('models', models.join(','));
    }

    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.status}`);
    }

    return response.json();
  }

  async getRandomClip(): Promise<RandomClip> {
    const response = await fetch(`${this.backendUrl}/random-clip`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch random clip: ${response.status}`);
    }

    return response.json();
  }
}

export const dockerAPI = new DockerAPI();