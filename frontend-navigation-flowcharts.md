# Frontend Navigation Flowcharts

This document provides visual flowcharts for the Accentric frontend application navigation flows using Mermaid.js.

## 1. Main Application Flow

```mermaid
graph TD
    A[App Start] --> B[Mode Selection]
    B --> C{User Choice}
    C -->|Practice Mode| D[Practice Mode Loading]
    C -->|Upload Mode| E[Audio Upload]
    
    D --> F[Random Audio Selection]
    F --> G[ASR Processing]
    G --> H[Validation Stage]
    
    E --> I[File Selection & Upload]
    I --> J[ASR Processing]
    J --> H[Validation Stage]
    
    H --> K[Pronoun Consolidation]
    K --> L[Accent Selection]
    L --> M[Particle Placement]
    M --> N[Transcription Comparison]
    N --> O[Editor Stage]
    O --> P[Final Submission]
    P --> Q[Completion Screen]
    Q --> B
```

## 2. Validation Stage Decision Flow

```mermaid
graph TD
    A[Validation Stage] --> B{Audio Playable?}
    B -->|No| C[Show Error State]
    B -->|Yes| D[Display Transcription]
    D --> E{User Action}
    E -->|Thumbs Up| F[Mark as Correct]
    E -->|Thumbs Down| G[Mark as Incorrect]
    E -->|Report Issue| H[Open Report Dialog]
    E -->|Back| I[Previous Stage]
    
    F --> J[Continue to Pronoun Consolidation]
    G --> J
    
    H --> K{Report Action}
    K -->|Submit & End Session| L[Clear Cache & Return to Mode Selection]
    K -->|Cancel| D
```

## 3. Report Dialog Flow

```mermaid
graph TD
    A[Report Issue Button] --> B[Open Report Dialog]
    B --> C[User Types Issue Description]
    C --> D{User Action}
    D -->|Submit Report & End Session| E[Log Report]
    D -->|Cancel & Continue Session| F[Close Dialog]
    E --> G[Clear All State]
    G --> H[Return to Mode Selection]
    F --> I[Continue Current Stage]
```

## 4. Editor Stage Flow

```mermaid
graph TD
    A[Enter Editor Stage] --> B{First Time?}
    B -->|Yes| C[Show Toast Notification]
    B -->|No| D[Show Editor Interface]
    
    C --> E{User Action on Toast}
    E -->|Click Explore| F[Open Features Dialog]
    E -->|Dismiss/Ignore| D
    
    F --> G[Show Feature Details]
    G --> H[Close Dialog]
    H --> D
    
    D --> I[Text Editor with Tools]
    I --> J{User Actions}
    J -->|Edit Text| I
    J -->|Use Ribbon Tools| K[Apply Formatting/Highlighting]
    J -->|Toggle Vim Mode| L[Switch Editor Mode]
    J -->|Submit| M[Continue to Next Stage]
    J -->|Back| N[Return to Comparison]
    
    K --> I
    L --> I
```

## 5. Accent Selection Flow

```mermaid
graph TD
    A[Accent Selection Stage] --> B[Display Accent Groups]
    B --> C{User Selection}
    C -->|Select Regional Group| D[Show Locale Options]
    C -->|Select Specific Locale| E[Process Selection]
    
    D --> F{User Chooses Locale}
    F -->|Select Locale| E
    F -->|Back to Groups| B
    
    E --> G{Already Processed?}
    G -->|Yes| H[Show 'Already Processed' Badge]
    G -->|No| I[Call ASR API]
    
    H --> J[Continue to Particle Placement]
    I --> K[Mark as Processed]
    K --> J
```

## 6. Practice Mode Initialization Flow

```mermaid
graph TD
    A[Practice Mode Selected] --> B{Docker Services Ready?}
    B -->|No| C[Show Docker Dialog]
    B -->|Yes| D[Start Practice Mode]
    
    C --> E{User Choice}
    E -->|Wait for Services| F[Wait for All Services Ready]
    E -->|Proceed Anyway| D
    
    F --> G{All Services Ready?}
    G -->|Yes| D
    G -->|No| F
    
    D --> H[Fetch Random CV22 Clip]
    H --> I[Download Audio]
    I --> J[Process through ASR]
    J --> K[Cache Results]
    K --> L[Go to Validation Stage]
```

## 7. Stage Navigation Flow

```mermaid
graph TD
    A[Any Stage] --> B{Navigation Action}
    B -->|Progress Bar Click| C{Stage Completed?}
    B -->|Back Button| D[Go to Previous Stage]
    B -->|Next Button| E{Current Stage Complete?}
    
    C -->|Yes| F[Navigate to Selected Stage]
    C -->|No| G[Stay on Current Stage]
    
    E -->|Yes| H[Go to Next Stage]
    E -->|No| I[Show Validation Error]
    
    F --> J[Restore Cached Data]
    J --> K[Display Selected Stage]
```

## 8. Cache Management Flow

```mermaid
graph TD
    A[User Action] --> B{Cache Decision Point}
    B -->|File Upload Complete| C[Cache Consensus Data]
    B -->|Stage Complete| D[Cache Stage Results]
    B -->|Navigation Back| E[Restore from Cache]
    B -->|File Removed| F[Clear All Cache]
    B -->|Mode Switch| G{Different Mode?}
    B -->|Session Abort| H[Clear All Cache]
    
    G -->|Yes| F
    G -->|No| I[Keep Existing Cache]
    
    C --> J[Store to SessionStorage]
    D --> J
    E --> K[Populate Component State]
    F --> L[Clear SessionStorage]
    H --> L
    
    J --> M[Update Component State]
    L --> N[Reset All State Variables]
```

## 9. Audio Playback Flow

```mermaid
graph TD
    A[Audio Player Component] --> B{Audio Source Available?}
    B -->|No| C[Show Disabled State]
    B -->|Yes| D[Show Play Button]
    
    D --> E{User Clicks Play}
    E -->|Click| F{Audio Currently Playing?}
    F -->|Yes| G[Pause Audio]
    F -->|No| H[Start Audio Playback]
    
    G --> I[Update UI to Paused State]
    H --> J[Update UI to Playing State]
    J --> K{Audio Ends?}
    K -->|Naturally| L[Reset to Paused State]
    K -->|Error| M[Handle Audio Error]
    K -->|User Pause| G
    
    I --> D
    L --> D
    M --> N[Show Error State]
```

## 10. Error Handling Flow

```mermaid
graph TD
    A[Error Occurs] --> B{Error Type}
    B -->|ASR Processing Error| C[Show Processing Error]
    B -->|Network Error| D[Show Connection Error]
    B -->|Audio Playback Error| E[Show Audio Error]
    B -->|Database Error| F[Show Database Error]
    B -->|Docker Service Error| G[Show Docker Dialog]
    
    C --> H{User Action}
    D --> H
    E --> H
    F --> H
    
    H -->|Retry| I[Retry Operation]
    H -->|Go Back| J[Return to Previous Stage]
    H -->|Abort| K[Clear State & Return to Mode Selection]
    
    G --> L{Service Status}
    L -->|Services Ready| M[Continue Operation]
    L -->|User Proceeds Anyway| N[Continue with Limited Functionality]
    L -->|User Waits| O[Wait for Services]
```

---

*These flowcharts represent the current navigation structure of the Accentric frontend application. They show the decision points, user interactions, and system responses throughout the application workflow.*