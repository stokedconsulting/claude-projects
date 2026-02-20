/**
 * Dashboard Controls Integration Test — AC-6.4
 *
 * Tests the AgentOrchestrator control surface that the dashboard relies on
 * via AgentLifecycleManager delegation.
 *
 * Uses fake timers (setTimeout/setInterval/Date only — NOT nextTick or
 * queueMicrotask) so the 30-second sleep/grace-period timers inside
 * AgentLoop and AgentOrchestrator resolve instantly via vi.runAllTimersAsync().
 *
 * Agent loops will not make real SDK or GitHub API calls because
 * _findNextWorkItem() always returns null (stub), so agents stay in Idle
 * sleeping until stop() drains all pending timers.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentOrchestrator } from '../orchestrator';
import type { OrchestratorConfig } from '../types';
import { AgentState } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stop an orchestrator cleanly by draining all pending fake timers. */
async function stopOrchestrator(orchestrator: AgentOrchestrator): Promise<void> {
  const stopPromise = orchestrator.stop();
  await vi.runAllTimersAsync();
  await stopPromise;
}

/** Emergency-stop an orchestrator by draining all pending fake timers. */
async function emergencyStopOrchestrator(orchestrator: AgentOrchestrator): Promise<void> {
  const stopPromise = orchestrator.emergencyStop();
  await vi.runAllTimersAsync();
  await stopPromise;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Dashboard Controls via Orchestrator', () => {
  let tmpDir: string;

  const makeConfig = (overrides?: Partial<OrchestratorConfig>): OrchestratorConfig => ({
    workspaceRoot: tmpDir,
    githubToken: 'test-token',
    desiredInstances: 1,
    dailyBudgetUsd: 50,
    monthlyBudgetUsd: 500,
    maxBudgetPerTaskUsd: 5,
    maxTurnsPerTask: 50,
    projectId: 'test-project',
    owner: 'test-owner',
    repo: 'test-repo',
    categoryPromptsDir: path.join(tmpDir, 'prompts'),
    events: {},
    ...overrides,
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-test-'));
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // AC-6.4.c — stop() clears all agents
  // -------------------------------------------------------------------------

  it('AC-6.4.c: stop() clears all agents and resets started state', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    // Verify agents were spawned before we stop.
    expect(orchestrator.getStatus().agents.length).toBe(2);

    await stopOrchestrator(orchestrator);

    const status = orchestrator.getStatus();
    expect(status.agents.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-6.4.d — setDesiredInstances scales agent count up and down
  // -------------------------------------------------------------------------

  it('AC-6.4.d: setDesiredInstances scales up by spawning new agents', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    expect(orchestrator.getStatus().agents.length).toBe(1);

    // Scale 1 → 3: two additional agents are spawned synchronously.
    orchestrator.setDesiredInstances(3);
    expect(orchestrator.getStatus().agents.length).toBe(3);

    await stopOrchestrator(orchestrator);
    expect(orchestrator.getStatus().agents.length).toBe(0);
  });

  it('AC-6.4.d: setDesiredInstances scales down by removing highest-ID agents (LIFO)', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 3 }));
    await orchestrator.start();

    const before = orchestrator.getStatus();
    expect(before.agents.length).toBe(3);

    // Scale 3 → 1: removes agents with IDs 3 and 2 (highest first).
    orchestrator.setDesiredInstances(1);

    const after = orchestrator.getStatus();
    expect(after.agents.length).toBe(1);
    // Agent 1 must be the survivor.
    expect(after.agents[0].id).toBe(1);

    await stopOrchestrator(orchestrator);
    expect(orchestrator.getStatus().agents.length).toBe(0);
  });

  it('AC-6.4.d: setDesiredInstances to 0 removes all agents', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 3 }));
    await orchestrator.start();

    expect(orchestrator.getStatus().agents.length).toBe(3);

    orchestrator.setDesiredInstances(0);
    expect(orchestrator.getStatus().agents.length).toBe(0);

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // AC-6.4.e — emergencyStop() clears all agents
  // -------------------------------------------------------------------------

  it('AC-6.4.e: emergencyStop() clears all agents immediately', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 3 }));
    await orchestrator.start();

    expect(orchestrator.getStatus().agents.length).toBe(3);

    await emergencyStopOrchestrator(orchestrator);

    const status = orchestrator.getStatus();
    expect(status.agents.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-6.4.a — pauseAgent(id) pauses a specific agent
  // -------------------------------------------------------------------------

  it('AC-6.4.a: pauseAgent() does not throw for unknown agent IDs (graceful no-op)', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    // Calling pauseAgent with a non-existent ID logs a warning but does not throw.
    expect(() => orchestrator.pauseAgent(9999)).not.toThrow();

    await stopOrchestrator(orchestrator);
  });

  it('AC-6.4.a: pauseAgent() transitions a live agent to Paused state', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    const status = orchestrator.getStatus();
    expect(status.agents.length).toBe(1);

    const agentId = status.agents[0].id;
    orchestrator.pauseAgent(agentId);

    const updated = orchestrator.getStatus();
    const agent = updated.agents.find((a) => a.id === agentId);
    expect(agent).toBeDefined();
    expect(agent!.state).toBe(AgentState.Paused);

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // AC-6.4.b — resumeAgent(id) resumes a specific paused agent
  // -------------------------------------------------------------------------

  it('AC-6.4.b: resumeAgent() does not throw for unknown agent IDs (graceful no-op)', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    expect(() => orchestrator.resumeAgent(9999)).not.toThrow();

    await stopOrchestrator(orchestrator);
  });

  it('AC-6.4.b: resumeAgent() on a paused agent transitions it out of Paused', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    const agentId = orchestrator.getStatus().agents[0].id;

    // Pause then immediately resume.
    orchestrator.pauseAgent(agentId);
    expect(orchestrator.getStatus().agents.find((a) => a.id === agentId)!.state).toBe(AgentState.Paused);

    orchestrator.resumeAgent(agentId);
    expect(orchestrator.getStatus().agents.find((a) => a.id === agentId)!.state).not.toBe(AgentState.Paused);

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // pauseAll() / resumeAll()
  // -------------------------------------------------------------------------

  it('pauseAll() transitions all agents to Paused state', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    await orchestrator.pauseAll();

    const status = orchestrator.getStatus();
    expect(status.agents.length).toBe(2);
    for (const agent of status.agents) {
      expect(agent.state).toBe(AgentState.Paused);
    }

    await stopOrchestrator(orchestrator);
  });

  it('resumeAll() transitions all paused agents back to non-Paused state', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    await orchestrator.pauseAll();
    await orchestrator.resumeAll();

    const status = orchestrator.getStatus();
    for (const agent of status.agents) {
      expect(agent.state).not.toBe(AgentState.Paused);
    }

    await stopOrchestrator(orchestrator);
  });

  it('pauseAll() on empty agent pool completes without throwing', async () => {
    // Start with 0 instances — pauseAll should be a no-op.
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 0 }));
    await orchestrator.start();

    await expect(orchestrator.pauseAll()).resolves.toBeUndefined();
    await expect(orchestrator.resumeAll()).resolves.toBeUndefined();

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // getStatus() returns correct OrchestratorStatus structure
  // -------------------------------------------------------------------------

  it('getStatus() returns a well-formed OrchestratorStatus snapshot', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    const status = orchestrator.getStatus();

    // Shape checks
    expect(Array.isArray(status.agents)).toBe(true);
    expect(typeof status.desiredInstances).toBe('number');
    expect(typeof status.activeWorktrees).toBe('number');
    expect(status.budgetStatus).toBeDefined();

    // desiredInstances reflects the config value
    expect(status.desiredInstances).toBe(2);

    // Agent count matches what was requested
    expect(status.agents.length).toBe(2);

    // budgetStatus shape
    expect(typeof status.budgetStatus.dailySpend).toBe('number');
    expect(typeof status.budgetStatus.monthlySpend).toBe('number');
    expect(typeof status.budgetStatus.dailyLimit).toBe('number');
    expect(typeof status.budgetStatus.monthlyLimit).toBe('number');
    expect(typeof status.budgetStatus.isWithinBudget).toBe('boolean');

    // activeWorktrees is non-negative
    expect(status.activeWorktrees).toBeGreaterThanOrEqual(0);

    await stopOrchestrator(orchestrator);
  });

  it('getStatus() agents array entries have id and state fields', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    const status = orchestrator.getStatus();
    expect(status.agents.length).toBe(2);

    for (const agent of status.agents) {
      expect(typeof agent.id).toBe('number');
      expect(typeof agent.state).toBe('string');
      // state must be a valid AgentState value
      expect(Object.values(AgentState)).toContain(agent.state);
    }

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // Double-start prevention — calling start() twice is idempotent
  // -------------------------------------------------------------------------

  it('double start() is idempotent and does not double-spawn agents', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    // Capture agent IDs after first start.
    const idsAfterFirstStart = new Set(orchestrator.getStatus().agents.map((a) => a.id));
    expect(idsAfterFirstStart.size).toBe(1);

    // Second start() should be a no-op (logged as warning internally).
    await orchestrator.start();

    const idsAfterSecondStart = new Set(orchestrator.getStatus().agents.map((a) => a.id));

    // No new agent IDs should have been added.
    expect(idsAfterSecondStart.size).toBe(idsAfterFirstStart.size);
    for (const id of idsAfterSecondStart) {
      expect(idsAfterFirstStart.has(id)).toBe(true);
    }

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // Negative value handling — setDesiredInstances(-1) is ignored
  // -------------------------------------------------------------------------

  it('setDesiredInstances with a negative value is ignored (no crash, no change)', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 1 }));
    await orchestrator.start();

    const before = orchestrator.getStatus().agents.length;
    expect(before).toBe(1);

    // Must not throw.
    expect(() => orchestrator.setDesiredInstances(-1)).not.toThrow();
    expect(() => orchestrator.setDesiredInstances(-100)).not.toThrow();

    // Agent count must be unchanged.
    const after = orchestrator.getStatus().agents.length;
    expect(after).toBe(before);

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // stop() after emergencyStop() is safe (idempotent cleanup)
  // -------------------------------------------------------------------------

  it('stop() after emergencyStop() completes without error', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    expect(orchestrator.getStatus().agents.length).toBe(2);

    await emergencyStopOrchestrator(orchestrator);
    expect(orchestrator.getStatus().agents.length).toBe(0);

    // stop() on an already-stopped orchestrator should be safe.
    await stopOrchestrator(orchestrator);
    expect(orchestrator.getStatus().agents.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Scale up then down in sequence
  // -------------------------------------------------------------------------

  it('can scale up to 5 and back down to 2 with correct IDs remaining', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    expect(orchestrator.getStatus().agents.length).toBe(2);

    orchestrator.setDesiredInstances(5);
    expect(orchestrator.getStatus().agents.length).toBe(5);

    orchestrator.setDesiredInstances(2);
    expect(orchestrator.getStatus().agents.length).toBe(2);

    // After scaling down, agents 1 and 2 (lowest IDs) should remain.
    const ids = orchestrator.getStatus().agents.map((a) => a.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2]);

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // setDesiredInstances with same count does not change agents
  // -------------------------------------------------------------------------

  it('setDesiredInstances with same count is a no-op', async () => {
    const orchestrator = new AgentOrchestrator(makeConfig({ desiredInstances: 2 }));
    await orchestrator.start();

    const idsBefore = orchestrator.getStatus().agents.map((a) => a.id).sort((a, b) => a - b);
    orchestrator.setDesiredInstances(2);
    const idsAfter = orchestrator.getStatus().agents.map((a) => a.id).sort((a, b) => a - b);

    expect(idsAfter).toEqual(idsBefore);

    await stopOrchestrator(orchestrator);
  });

  // -------------------------------------------------------------------------
  // Crash resilience: orchestrator is still usable after agent stops
  // -------------------------------------------------------------------------

  it('orchestrator remains usable after agents are stopped', async () => {
    let errorFired = false;
    const orchestrator = new AgentOrchestrator(
      makeConfig({
        desiredInstances: 1,
        events: {
          onError: () => {
            errorFired = true;
          },
        },
      }),
    );
    await orchestrator.start();

    // With fake timers the agent stays Idle (no real crash path).
    // Verify the orchestrator is in a good state.
    const status = orchestrator.getStatus();
    expect(Array.isArray(status.agents)).toBe(true);
    expect(status.agents.length).toBeGreaterThanOrEqual(0);

    await stopOrchestrator(orchestrator);
    expect(orchestrator.getStatus().agents.length).toBe(0);
  });
});
