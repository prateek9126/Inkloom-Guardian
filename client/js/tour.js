/**
 * Inkloom Guardian - 12-Step Judge Interactive Tour Guide (Vanilla JavaScript)
 */
class DemoTourGuide {
  constructor() {
    this.steps = [];
    this.currentStepIdx = parseInt(localStorage.getItem('inkloom_demo_step') || '0', 10);
    this.isOpen = localStorage.getItem('inkloom_demo_open') !== 'false';
    this.isMinimized = false;
    this.container = null;
    this.init();
  }

  async init() {
    try {
      const res = await window.api.getDemoWalkthroughSteps();
      if (res && res.steps) {
        this.steps = res.steps;
        this.render();
      }
    } catch (err) {
      console.warn('Failed to load demo walkthrough steps:', err.message);
    }
  }

  openTour() {
    this.isOpen = true;
    this.isMinimized = false;
    localStorage.setItem('inkloom_demo_open', 'true');
    this.render();
  }

  closeTour() {
    this.isOpen = false;
    localStorage.setItem('inkloom_demo_open', 'false');
    this.render();
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.render();
  }

  async nextStep() {
    if (this.currentStepIdx < this.steps.length - 1) {
      this.currentStepIdx++;
      localStorage.setItem('inkloom_demo_step', this.currentStepIdx.toString());
      const next = this.steps[this.currentStepIdx];
      if (next && next.route) {
        window.location.hash = next.route.startsWith('/') ? '#' + next.route : '#/' + next.route;
      }
      this.render();
    }
  }

  async prevStep() {
    if (this.currentStepIdx > 0) {
      this.currentStepIdx--;
      localStorage.setItem('inkloom_demo_step', this.currentStepIdx.toString());
      const prev = this.steps[this.currentStepIdx];
      if (prev && prev.route) {
        window.location.hash = prev.route.startsWith('/') ? '#' + prev.route : '#/' + prev.route;
      }
      this.render();
    }
  }

  async setStep(idx) {
    if (idx >= 0 && idx < this.steps.length) {
      this.currentStepIdx = idx;
      localStorage.setItem('inkloom_demo_step', idx.toString());
      const step = this.steps[idx];
      if (step && step.route) {
        window.location.hash = step.route.startsWith('/') ? '#' + step.route : '#/' + step.route;
      }
      this.render();
    }
  }

  async executeStepAction(step) {
    if (!step) return;

    if (step.personaRequirement) {
      try {
        await window.auth.switchDemoRole(step.personaRequirement);
        window.toast.success(`Switched persona to: ${step.personaRequirement.replace(/_/g, ' ')}`);
      } catch (err) {
        console.warn('Persona switch warning:', err.message);
      }
    }

    if (step.route) {
      window.location.hash = step.route.startsWith('/') ? '#' + step.route : '#/' + step.route;
    }
  }

  async resetDemo() {
    if (!confirm('Reset the VOLTERRA demonstration environment back to baseline demonstration state?')) {
      return;
    }
    try {
      window.toast.info('Resetting demonstration environment...');
      const res = await window.api.resetDemo();
      window.auth.setUser(res.auth.user, res.auth.token);
      this.currentStepIdx = 0;
      localStorage.setItem('inkloom_demo_step', '0');
      localStorage.setItem('inkloom_demo_open', 'true');
      window.toast.success('Demonstration state restored to baseline.');
      window.location.hash = '#/dashboard';
      window.location.reload();
    } catch (err) {
      window.toast.error('Failed to reset demo: ' + err.message);
    }
  }

  render() {
    let el = document.getElementById('demo-tour-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-tour-container';
      document.body.appendChild(el);
    }

    if (!this.isOpen || this.steps.length === 0) {
      el.innerHTML = `
        <button
          onclick="window.tour.openTour()"
          class="fixed bottom-5 right-5 z-40 bg-slate-900 text-white p-3 rounded-full shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 border border-slate-700 text-xs font-semibold"
          title="Open Judge Tour"
        >
          <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
          <span class="hidden sm:inline">Judge Tour</span>
        </button>
      `;
      return;
    }

    const step = this.steps[this.currentStepIdx] || this.steps[0];
    const total = this.steps.length;

    if (this.isMinimized) {
      el.innerHTML = `
        <div class="fixed bottom-5 right-5 z-40 bg-white border border-slate-800 rounded-lg shadow-xl p-3 flex items-center gap-3">
          <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span class="text-xs font-bold text-slate-900">Step ${this.currentStepIdx + 1}/${total}: ${step.title}</span>
          <button onclick="window.tour.toggleMinimize()" class="text-slate-500 hover:text-slate-800 p-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </button>
          <button onclick="window.tour.closeTour()" class="text-slate-400 hover:text-slate-600 p-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="tour-card p-5">
        <!-- Top bar -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              Step ${this.currentStepIdx + 1} of ${total}
            </span>
            <span class="badge badge-demo">VOLTERRA DEMO</span>
          </div>
          <div class="flex items-center gap-1.5 text-slate-400">
            <button onclick="window.tour.toggleMinimize()" class="hover:text-slate-600 p-1" title="Minimize">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <button onclick="window.tour.closeTour()" class="hover:text-slate-600 p-1" title="Close">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="py-3">
          <h4 class="text-sm font-bold text-slate-900 leading-snug">${step.title}</h4>
          <p class="text-xs text-slate-600 mt-1.5 leading-relaxed">${step.description}</p>
          
          ${step.personaRequirement ? `
            <div class="mt-2.5 flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs">
              <span class="text-slate-500">Target Role:</span>
              <strong class="text-slate-900 capitalize font-medium">${step.personaRequirement.replace(/_/g, ' ')}</strong>
            </div>
          ` : ''}
        </div>

        <!-- Action / Jump Button -->
        <div class="pb-3">
          <button
            onclick="window.tour.executeStepAction(window.tour.steps[window.tour.currentStepIdx])"
            class="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-1.5"
          >
            <span>Navigate to this Feature</span>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>

        <!-- Bottom Navigation Controls -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <button
              onclick="window.tour.prevStep()"
              ${this.currentStepIdx === 0 ? 'disabled' : ''}
              class="btn-subtle text-xs px-2.5 py-1 ${this.currentStepIdx === 0 ? 'opacity-40 cursor-not-allowed' : ''}"
            >
              Previous
            </button>
            <button
              onclick="window.tour.nextStep()"
              ${this.currentStepIdx === total - 1 ? 'disabled' : ''}
              class="btn-primary text-xs px-3 py-1 ${this.currentStepIdx === total - 1 ? 'opacity-40 cursor-not-allowed' : ''}"
            >
              Next Step
            </button>
          </div>

          <button
            onclick="window.tour.resetDemo()"
            class="btn-subtle text-[11px] text-slate-500 hover:text-red-600"
            title="Restore baseline demonstration state"
          >
            Reset Demo
          </button>
        </div>
      </div>
    `;
  }
}

window.tour = new DemoTourGuide();
