# OpenClaw Installation Journey

## Purpose

This is a first-hand record of learning, installing, and using OpenClaw from the perspective of a technically capable but security-conscious newcomer.

The immediate goal is to get OpenClaw running safely and understand how the product works. The longer-term goal is to identify evidence-backed contribution opportunities and turn the journey into an application case study.

This document records the experience before proposing solutions. It should preserve uncertainty, hesitation, failed attempts, and changes in understanding instead of rewriting the journey as if everything was obvious.

## Working agreement

- Chris reports where he is, what he sees, what he expected, and what he is thinking.
- Codex records meaningful observations in this file.
- Observed facts stay separate from interpretations and solution ideas.
- Each exchange ends with one concrete next step.
- We do not open an issue, design a solution, or write implementation code until the walkthrough produces enough evidence.
- Sensitive information such as API keys, tokens, usernames, device identifiers, and private paths must be redacted.

## Research questions

1. Can a newcomer choose an installation path that fits their goals and risk tolerance?
2. Can they understand what will be downloaded, installed, changed, or started?
3. Does the product earn enough trust to proceed at each consequential step?
4. Is the transition from installation to onboarding understandable?
5. How long does it take to accomplish a first useful task?
6. Can the user pause, recover, reset, or uninstall confidently?

## Starting context

### What prompted the walkthrough

Chris wants to become genuinely familiar with OpenClaw, contribute meaningfully to the open-source project, and apply for the OpenClaw Foundation Product Designer role with shipped proof rather than a speculative redesign.

### Prior expectations and concerns

- The recommended `curl -fsSL https://openclaw.ai/install.sh | bash` command created an immediate security concern because it executes a remote script directly.
- Chris prefers to explore OpenClaw in an isolated VM before trusting it on his primary Mac.
- An initial contribution hypothesis is a clearer, more interactive, trust-oriented path through installation.
- This remains a hypothesis. The walkthrough may reveal a different or narrower opportunity.

### Starting state

- OpenClaw has not yet been installed as part of this recorded walkthrough.
- No contribution scope has been selected.
- No issue or pull request has been opened.

## Journey log

For each meaningful moment, record:

- **Stage:** Where in the journey this happened
- **Action:** What Chris did
- **Expected:** What he thought would happen
- **Observed:** What actually happened
- **Reaction:** Questions, concerns, confidence, or confusion in the moment
- **Evidence:** Exact copy, command, error, screenshot, or link when useful
- **Severity:** Blocker, significant friction, minor friction, or positive moment
- **Opportunity hypothesis:** A possible improvement, clearly marked as unvalidated
- **Next step taken:** What happened immediately afterward

### Entry 0 — Before installation

- **Stage:** Choosing whether and how to install
- **Action:** Reviewed the recommended one-line installer command.
- **Expected:** A trustworthy path that explained what OpenClaw would change before asking for execution.
- **Observed:** The most visible path used a remote script piped directly into Bash.
- **Reaction:** Security concern and reluctance to run the command on the primary Mac.
- **Evidence:** `curl -fsSL https://openclaw.ai/install.sh | bash`
- **Severity:** Blocker on the primary machine; motivation to consider a VM.
- **Opportunity hypothesis:** OpenClaw may need a more visible review-before-running or isolated-evaluation path.
- **Next step taken:** Chose to begin a documented discovery walkthrough before defining a contribution.

### Entry 1 — Looking for consequences after “Get Started”

- **Stage:** Initial website navigation
- **Action:** Clicked **Get Started**, then began scrolling rather than immediately choosing or executing an installation option.
- **Expected:** Not yet fully stated; Chris was looking for information that would answer “What happens if …” before proceeding.
- **Observed:** The answer was not immediately apparent at the point where Chris expected to find it, so he continued scrolling.
- **Reaction:** An unfinished but consequential question: “What happens if …”
- **Evidence:** First-hand report during the walkthrough. Exact page copy and the rest of the question are still needed.
- **Severity:** Undetermined. This may be normal orientation or an early information-gap signal.
- **Opportunity hypothesis:** None yet. Preserve the question before interpreting it.
- **Next step taken:** Pause and capture the complete question plus the content currently visible on screen.

### Entry 2 — Installation method versus installation boundary

- **Stage:** Comparing the visible one-line and npm installation options
- **Action:** Considered whether to use the install one-liner or npm.
- **Expected:** Enough context to know whether either option installs directly on the current computer and to compare privacy and security choices before proceeding.
- **Observed:** The visible choices described installation mechanisms, but Chris did not yet know that both would install on the current host. A VM was known to be possible, but the path for starting with one was not apparent.
- **Reaction:** “I'm curious whether it installs DIRECTLY on the computer I'm using right now. I'd like to know what my options are with security and privacy. All I know is a VM is an option, but how do I even get started there?”
- **Evidence:** First-hand report while viewing the Get Started installation choices.
- **Severity:** Blocker. Chris cannot confidently choose an installation command until the environment and security consequences are clear.
- **Opportunity hypothesis:** Installation guidance may organize choices around technical mechanisms when a newcomer first needs to choose a trust boundary: primary computer, dedicated OS user, VM, container, or remote host.
- **Next step taken:** Clarify what the commands affect, then inspect the documented VM path without installing anything yet.

### Entry 3 — Developer knowledge assumed by the safer path

- **Stage:** Trying to identify OpenClaw's recommended VM approach
- **Action:** Asked what OpenClaw recommends for a VM and considered the experience of people who are not developers.
- **Expected:** A beginner-accessible recommendation that explains which environment to choose, why to choose it, and how to begin safely.
- **Observed:** The official macOS VM documentation recommends a small Linux VPS, dedicated hardware, or a hybrid setup for most long-running deployments. It recommends a local macOS VM with Lume when macOS-only capabilities or strict separation from the daily Mac are needed. That path assumes familiarity with Terminal, remote scripts, VMs, SSH, IP addresses, background processes, configuration files, and daemons.
- **Reaction:** “I'm curious if there are people who aren't developers trying to understand and get started on using this. They are in a much worse place.”
- **Evidence:** OpenClaw's macOS VM guide labels its short Lume instructions a “Quick path (Lume, experienced users)” and then uses CLI-driven setup throughout.
- **Severity:** Significant friction for non-developers; not necessarily a blocker for experienced operators.
- **Opportunity hypothesis:** A beginner path may need to explain environment choices and technical concepts progressively instead of presenting an operator-oriented deployment recipe.
- **Next step taken:** Review the recommendation in plain language before deciding whether Lume is appropriate for this walkthrough.

### Entry 4 — Checking whether the current Mac can host the recommended VM

- **Stage:** VM compatibility check
- **Action:** Opened **About This Mac** and **System Settings → General → Storage**, then shared screenshots.
- **Expected:** Determine whether the current Mac meets Lume's documented requirements before installing another tool.
- **Observed:** The Mac has an Apple M2 chip, 24 GB of memory, macOS Tahoe 26.4.1, and approximately 570 GB of available storage. This exceeds the documented requirements of Apple Silicon, macOS Sequoia or newer, and approximately 60 GB free per VM.
- **Reaction:** No incompatibility surfaced at this checkpoint.
- **Evidence:** Local system screenshots. A device serial number was visible and intentionally excluded from this log; public case-study screenshots will require redaction.
- **Severity:** Positive checkpoint. The recommended local macOS VM path is technically available on this hardware.
- **Opportunity hypothesis:** Security-sensitive onboarding should remind users to review screenshots and logs for device identifiers and credentials before sharing them publicly.
- **Next step taken:** Inspect Lume's own installation options without executing its remote installer yet.

### Entry 5 — Installing Lume and discovering the installation consequences

- **Stage:** Installing the VM tool on the host Mac
- **Action:** Ran the Lume installer. It detected an Apple Silicon Mac, downloaded the baked `lume-v0.3.16` release from the `trycua/cua` GitHub repository, extracted it, and completed installation.
- **Expected:** Not yet captured. Chris's expectation immediately before running the installer is still needed.
- **Observed:** The installer placed the Lume app bundle under the user's local data directory and the CLI under the user's local binary directory. It reported that the binary directory was not on `PATH` and supplied shell-profile commands to add it. It stated that telemetry defaults to enabled, described the bounded metadata it collects, and supplied a persistent opt-out command. It also created and loaded a per-user LaunchAgent so the Lume daemon starts automatically at login, then supplied commands for checking status, reading logs, removing the service, checking for updates, and applying an update. Updates are explicit rather than automatic.
- **Reaction:** Not yet captured. Chris's response to the enabled-by-default telemetry, login daemon, requested shell-profile change, and overall installation receipt is still needed.
- **Evidence:** First-hand terminal transcript. User-specific and temporary paths are generalized here; the original transcript should be redacted before any public use.
- **Severity:** Undetermined until Chris's expectation and reaction are captured. The installation completed successfully, while also revealing persistent host changes that were not part of the earlier compatibility check.
- **Opportunity hypothesis:** Do not add a new solution hypothesis yet. First determine whether the installer explained these consequences before execution or only reported them afterward, and whether the post-install receipt gave Chris enough control.
- **Next step taken:** Pause before configuring `PATH` or invoking Lume and capture what Chris expected the installer to do, what—if anything—surprised or concerned him, and whether the receipt made the changes feel understandable and reversible.

### Entry 6 — Successful installation still produced “command not found”

- **Stage:** First attempt to invoke Lume
- **Action:** Opened a restored terminal session and ran `lume`, then `lume --version`. After both returned `command not found`, ran the installer a second time and tried `lume --version` again.
- **Expected:** Because the installer said “Lume has been successfully installed” and “Run lume to get started,” the `lume` command was expected to work, particularly after reopening the terminal.
- **Observed:** Reinstalling downloaded and installed the same `v0.3.16` release and reloaded the existing LaunchAgent, but the command remained unavailable. A local check confirmed that the binary exists, is executable, and returns version `0.3.16` when invoked by its full path. The active terminal was Bash, and the required local binary directory had not been added to `~/.bash_profile`. Restarting the terminal alone could not fix that missing configuration.
- **Reaction:** “Why can't I run Lume?” The successful-installation message led to repeated installation rather than to completing the separate `PATH` configuration step.
- **Evidence:** First-hand terminal transcript plus a read-only local check of the executable and shell-profile state. User-specific paths are generalized here.
- **Severity:** Significant friction. The product was installed correctly, but the user could not start it and repeated a consequential remote-script installation while troubleshooting.
- **Opportunity hypothesis:** The installer may need to distinguish “files installed” from “command ready,” make the remaining required action harder to miss, or apply/verify shell configuration before presenting the generic “Run lume” instruction. This remains unvalidated until the documented setup step is completed and the surrounding guidance is reviewed.
- **Next step taken:** Add the local binary directory to the Bash login profile, reload that profile, and verify `lume --version` before proceeding to VM creation.

### Entry 7 — Completing the shell configuration and reaching the CLI

- **Stage:** Recovering from the first-run command failure
- **Action:** Added the local binary directory to `~/.bash_profile`, sourced the profile, and ran `lume --version`. Then invoked `lume` without a subcommand to inspect its top-level help.
- **Expected:** Bash should resolve the short `lume` command after the installer-provided configuration step was completed.
- **Observed:** Version verification returned `0.3.16`. Invoking `lume` displayed an overview, usage syntax, global options, and the available VM, image, server, configuration, logging, and update subcommands.
- **Reaction:** No further confusion or error was reported after the configuration change.
- **Evidence:** First-hand terminal transcript showing the profile update, successful version output, and top-level help.
- **Severity:** Positive recovery checkpoint. The CLI is now installed, discoverable, and usable by its short command.
- **Opportunity hypothesis:** The recovery confirms that the earlier failure was a shell-discovery problem rather than a damaged installation. It also strengthens the hypothesis that installation completion and command readiness should be communicated as separate states.
- **Next step taken:** Check the current telemetry status and make an explicit privacy choice before creating or downloading a VM.

### Entry 8 — Verifying the telemetry default

- **Stage:** Privacy check before the first VM operation
- **Action:** Ran `lume config telemetry status` without changing the configuration.
- **Expected:** Confirm whether the installer notice described only a general default or the active state of this installation.
- **Observed:** Telemetry was enabled from a persisted preference, and a pseudonymous installation ID was already present. The status output repeated that telemetry excludes prompts, VM and image names, file paths, and VM contents.
- **Reaction:** Not yet captured. Chris has not yet chosen whether to keep or disable telemetry or whether to delete the existing installation ID.
- **Evidence:** First-hand terminal output: telemetry enabled, effective source persisted, persisted preference true, installation ID present. The ID itself was redacted by the command.
- **Severity:** Undetermined. The state is inspectable and described in bounded terms, but telemetry was active before an explicit choice in this walkthrough.
- **Opportunity hypothesis:** A security-conscious setup path may benefit from making telemetry consent an explicit pre-install or first-run decision. Before treating this as a contribution opportunity, determine whether Lume or OpenClaw intentionally uses notice-and-opt-out and whether maintainers would accept a change.
- **Next step taken:** Make an explicit choice to keep telemetry enabled or disable it; if disabling, separately decide whether to remove the already-created pseudonymous installation ID.

### Entry 9 — Opting out of telemetry and resetting the identifier

- **Stage:** Applying the privacy choice before the first VM operation
- **Action:** Ran `lume config telemetry disable`, then `lume config telemetry reset-id`, and invoked the status command again.
- **Expected:** Persist telemetry as disabled, remove the pseudonymous installation ID, and verify both results.
- **Observed:** Lume reported that the telemetry setting was updated to disabled. It then reported that the installation ID was reset and that the enabled/disabled preference was preserved. The final status showed telemetry disabled from a persisted preference, with no installation ID created.
- **Reaction:** No error or additional concern was reported during the opt-out actions.
- **Evidence:** First-hand terminal transcript containing successful disable and reset confirmations. No identifier value was exposed.
- **Severity:** Positive control checkpoint. Lume exposed separate controls for data collection and the local pseudonymous identifier and confirmed both operations in plain language.
- **Opportunity hypothesis:** Preserve this as evidence that post-install privacy controls are discoverable and granular once the user reaches the relevant CLI. The remaining question is whether users should need to discover and exercise them only after telemetry has initially been enabled.
- **Next step taken:** Proceed to the official first VM-creation step, after verifying the current command and understanding what it will download and change.

### Entry 10 — Creating the isolated macOS VM

- **Stage:** First VM creation
- **Action:** Ran `lume create openclaw --os macos --ipsw latest` after disabling telemetry and resetting the installation ID.
- **Expected:** Download the latest supported macOS image, create a VM named `openclaw`, and automatically open a VNC window for Setup Assistant. The OpenClaw guide described approximately 60 GB free disk space per VM and an approximately 20-minute process.
- **Observed:** Lume configured the VM with 4 CPUs, 8 GB of memory, a 1024×768 display, and a 102,400 MB virtual disk. It downloaded the IPSW in approximately 6 minutes 41 seconds, installed macOS in approximately 3 minutes 34 seconds, and reported successful VM creation approximately 10 minutes 16 seconds after the command began. Disk validation reported a 107.37 GB disk image. Contrary to the guide's stated outcome, a VNC window did not open.
- **Reaction:** “It didn't launch. What do I do?” The terminal's successful-creation message did not clarify that the VM was stopped or supply the next recovery command.
- **Evidence:** First-hand terminal transcript. User-specific temporary paths and the VM's generated internal identifier are intentionally omitted.
- **Severity:** Positive completion with a potentially significant expectation mismatch. Creation was successful and faster than the guide's estimate, but the provisioned virtual disk was substantially larger than the guide's approximate 60 GB requirement.
- **Opportunity hypothesis:** Installation guidance may need to distinguish available-space requirements, configured virtual capacity, and actual host storage consumption. First verify whether the 107.37 GB disk is sparse and how much host storage it currently occupies before treating this as user-impacting friction.
- **Next step taken:** Inspect the VM state and run options before attempting a manual start.

### Entry 11 — Finding the newly created VM stopped

- **Stage:** Recovering the missing first display
- **Action:** Performed a read-only `lume ls` check and inspected `lume help run` after no VNC window appeared.
- **Expected:** Determine whether VM creation failed, the VM was running without a display, or it had been created but not started.
- **Observed:** The `openclaw` VM exists with 4 CPUs, 8 GB memory, a 100 GB configured disk showing 21.2 GB used, and a 1024×768 display, but its status is `stopped`. It has no IP, SSH endpoint, or VNC session. The run command starts a display by default; `--no-display` is the option that suppresses it.
- **Reaction:** The stopped state explains why nothing launched, but this state was not surfaced by the successful-creation output.
- **Evidence:** Read-only local output from `lume ls` and `lume help run`.
- **Severity:** Significant but recoverable friction. The VM was created successfully, but the documented automatic transition to Setup Assistant did not occur.
- **Opportunity hypothesis:** The create flow may need either to launch the VM reliably or end with explicit state and next-action guidance such as “VM created and stopped; run …”. First observe whether the manual start succeeds and whether this behavior is reproducible.
- **Next step taken:** Run `lume run openclaw` without `--no-display` and observe whether the VNC client opens Setup Assistant.

### Entry 12 — Manual start reaches Setup Assistant and requests host microphone access

- **Stage:** First visible VM launch
- **Action:** Ran `lume run openclaw` with its default display behavior.
- **Expected:** Open the VM display at the beginning of macOS Setup Assistant.
- **Observed:** A window titled **Virtualization** opened to the macOS language-selection screen with English selected. Separately, macOS displayed a host-level permission prompt stating that Terminal wanted microphone access, with **Don't Allow** and **Allow** choices.
- **Reaction:** Not yet captured. The microphone request was not mentioned in the OpenClaw VM instructions and its relationship to Lume or the virtualization session was not explained on screen.
- **Evidence:** First-hand screenshots of the Terminal microphone permission and the VM's macOS language-selection screen. No visible identifier or credential was included.
- **Severity:** Positive recovery plus an unexplained permission decision. Manual start reached the expected Setup Assistant, while the host microphone request introduced a new trust question.
- **Opportunity hypothesis:** VM setup guidance may need to explain host permission prompts caused by the virtualization session, including which capabilities are optional and what functionality is lost when denied. Do not attribute the prompt to a specific implementation mechanism without verification.
- **Next step taken:** Deny Terminal microphone access because it is unnecessary for the isolated setup, then continue from the English language selection.

### Entry 13 — Completing macOS Setup Assistant

- **Stage:** Establishing the isolated macOS environment
- **Action:** Continued through the standard macOS Setup Assistant and created the VM-local account.
- **Expected:** Reach a usable macOS desktop inside the Virtualization window without granting unnecessary services or sharing credentials.
- **Observed:** The VM reached the macOS desktop successfully. A desktop widget displayed **Location Access Needed**, but location access is not required for this OpenClaw evaluation.
- **Reaction:** No setup error or additional blocker was reported.
- **Evidence:** First-hand screenshot of the macOS desktop inside the Virtualization window. No username, password, or device identifier was visible.
- **Severity:** Positive checkpoint. The isolated operating system is usable, and optional location access can remain denied.
- **Opportunity hypothesis:** None added. Standard macOS onboarding is outside the likely OpenClaw contribution scope unless later steps depend on a choice made here.
- **Next step taken:** In the VM, enable **Remote Login** under **System Settings → General → Sharing** so the host can connect over SSH.

### Entry 14 — Enabling SSH without broader remote control

- **Stage:** Preparing host-to-VM access
- **Action:** Opened **System Settings → General → Sharing** inside the VM and enabled **Remote Login**.
- **Expected:** Permit SSH access to the isolated VM without enabling unrelated remote-control services.
- **Observed:** **Remote Login** displayed as enabled. **Remote Management**, **Remote Application Scripting**, Internet Sharing, Bluetooth Sharing, and Printer Sharing remained disabled.
- **Reaction:** No error or additional permission prompt was reported.
- **Evidence:** First-hand screenshot of the VM's Sharing settings. The VM-specific local hostname is intentionally omitted from this log.
- **Severity:** Positive security checkpoint. The required access path is enabled while broader sharing services remain off.
- **Opportunity hypothesis:** None added. The OpenClaw guide's System Settings path matched the current macOS interface and was straightforward once the VM desktop was available.
- **Next step taken:** From a separate host Terminal session, retrieve the running VM's address with `lume get openclaw`.

### Entry 15 — Retrieving the VM connection details

- **Stage:** Establishing the first host-to-VM connection
- **Action:** Opened a separate Terminal session on the host Mac and ran `lume get openclaw` while leaving the displayed VM running.
- **Expected:** Confirm the VM is running, obtain its private IP address, and verify SSH availability.
- **Observed:** Lume reported the `openclaw` VM as running on NAT networking at `192.168.64.3`, with SSH available. It reported 25.5 GB used of a 100.0 GB configured disk. A VNC URL bound to the host loopback address was also displayed and included a session password.
- **Reaction:** No connection error was reported. The full output was shared before the credential embedded in the VNC URL was recognized as sensitive.
- **Evidence:** First-hand terminal output. The VNC URL and password are intentionally excluded from this log.
- **Severity:** Positive connectivity checkpoint with a minor credential-disclosure risk. The private VM address and SSH readiness were clear, but the mixed output placed a shareable status alongside a VNC credential.
- **Opportunity hypothesis:** CLI status output may benefit from masking embedded VNC credentials by default or separating secrets from commonly shared diagnostic information. Validate intended threat model and existing redaction options before proposing a change.
- **Next step taken:** Connect over SSH using the private address and the VM-local account, without sharing the username or password.

### Entry 16 — Reaching SSH's first-connection trust prompt

- **Stage:** Authenticating the VM before the first SSH session
- **Action:** Ran SSH from the host Mac to the VM-local account at the private NAT address.
- **Expected:** Reach either the VM password prompt or SSH's standard first-connection host-key confirmation.
- **Observed:** SSH reported that the host's authenticity could not yet be established, displayed an ED25519 fingerprint, and requested an explicit `yes`, `no`, or fingerprint response. This is expected because the newly created VM has not previously been added to the host's `known_hosts` file.
- **Reaction:** The host key was accepted. A later screenshot confirmed that the ED25519 fingerprint displayed directly inside the VM matched the fingerprint presented by the host SSH client.
- **Evidence:** First-hand terminal output. The VM username and machine-specific fingerprint are intentionally omitted from this log.
- **Severity:** Expected security checkpoint, not an error. SSH is asking the user to establish trust on first contact.
- **Opportunity hypothesis:** None added. This is standard SSH behavior; the relevant product question is whether the OpenClaw guide should briefly explain verification for security-conscious newcomers rather than simply instructing them to connect.
- **Next step taken:** Accepted and saved the host key; the server then closed the connection before presenting a password prompt.

### Entry 17 — First trusted SSH connection closes before authentication

- **Stage:** Recovering the first SSH login
- **Action:** Entered `yes` at the host-authenticity prompt. After the connection closed, performed a passwordless diagnostic handshake from the host without attempting to authenticate.
- **Expected:** Save the verified host key, receive the VM account's password prompt, and enter the shell.
- **Observed:** SSH permanently added the VM's ED25519 key to the host's `known_hosts` file, then immediately reported that the VM closed port 22. A subsequent diagnostic connection completed key exchange, matched the saved host key, reached the authentication service, and reported that public-key, password, and keyboard-interactive authentication are available. It ended at the expected permission denial because the diagnostic intentionally supplied no credentials.
- **Reaction:** The initial close looked like another failure even though networking, host-key trust, and the SSH service were functioning on the following check.
- **Evidence:** First-hand terminal output plus a credential-free verbose SSH handshake. Account names, fingerprints, and local key metadata are omitted.
- **Severity:** Minor recoverable friction pending a successful retry. The first trusted connection closed unexpectedly, but the service now reaches the authentication stage normally.
- **Opportunity hypothesis:** Do not attribute this transient close to OpenClaw or Lume unless it repeats. One occurrence immediately after enabling Remote Login may reflect service startup timing.
- **Next step taken:** Retry the ordinary SSH command and enter the VM-local password when prompted.

### Entry 18 — Completing the first SSH login

- **Stage:** Entering the isolated VM from the host
- **Action:** Retried the ordinary SSH command, entered the VM-local password, and reached the VM shell.
- **Expected:** Authenticate to the VM-local account and obtain an interactive shell inside the isolated macOS environment.
- **Observed:** The second connection presented the password prompt and succeeded. The resulting prompt identified the VM environment, confirming that subsequent installation commands can be run inside the VM rather than on the host Mac.
- **Reaction:** No further SSH error was reported after the retry.
- **Evidence:** First-hand terminal screenshot. Host and VM usernames, hostnames, fingerprints, private addresses, and the credential-bearing VNC URL are intentionally omitted.
- **Severity:** Positive recovery checkpoint. Host-to-VM access now works end to end.
- **Opportunity hypothesis:** The transient first close did not repeat, so it remains insufficient evidence for a product change.
- **Next step taken:** Verify the current official OpenClaw installation and onboarding commands, then run them only from the confirmed VM shell.

### Entry 19 — The fresh VM lacks the documented installer prerequisite

- **Stage:** Preparing to install OpenClaw inside the VM
- **Action:** Before running the VM guide's `npm install -g openclaw@latest` command, checked `node --version` and `npm --version` inside the fresh VM.
- **Expected:** Either confirm that the required runtime and package manager were available or receive guidance from the VM setup path for installing them first.
- **Observed:** Both commands returned `command not found`. The current OpenClaw install overview requires a supported Node release and says its recommended hosted installer handles Node automatically, but the macOS VM guide instead proceeds directly from SSH access to npm installation without a Node-installation step or prerequisite check.
- **Reaction:** Not yet captured. The walkthrough paused before attempting the known-to-fail npm instruction or executing another remote installer.
- **Evidence:** First-hand screenshot from the VM Terminal plus the current official OpenClaw macOS VM and install documentation.
- **Severity:** Blocker in the documented VM path. A user following the guide from a fresh macOS VM cannot execute its next installation command.
- **Opportunity hypothesis:** The macOS VM guide needs either a Node installation step, a link to the Node prerequisites, or the hosted installer command that provisions Node automatically. The best correction should be validated against maintainer preferences and tested from a fresh VM.
- **Next step taken:** Use the isolation boundary as intended, but preserve the original review-before-execution goal by downloading the official OpenClaw installer script without running it and inspecting its behavior first.

### Entry 20 — The documented stop command does not stop the displayed VM

- **Stage:** Safely pausing the walkthrough overnight
- **Action:** Exited the SSH session, ran `lume stop openclaw`, checked `lume ls`, then retried the stop command twice more while also initiating shutdown from inside macOS.
- **Expected:** Stop the running VM and confirm a `stopped` status before leaving the host unattended.
- **Observed:** Each stop attempt reported that it found a process holding the VM configuration lock, then returned to the shell without reporting successful shutdown. After the first and second attempts, `lume ls` still reported the VM as running with SSH and VNC active. After shutdown was initiated inside macOS and a third stop attempt returned the same way, Lume still reported `running` and an active VNC endpoint, although SSH had changed from available to unavailable. A later independent poll showed the same state.
- **Reaction:** The shutdown instruction did not produce the promised safe stopping point and required additional diagnosis at the end of the session.
- **Evidence:** First-hand terminal transcript and a read-only follow-up `lume ls` check. Process identifiers, paths, addresses, and the credential-bearing VNC URL are omitted.
- **Severity:** Significant friction. A user attempting a normal documented shutdown could reasonably believe the command acted after it returned to the prompt, even though the VM remained active.
- **Opportunity hypothesis:** Lume's stop flow may need to wait for completion, report failure explicitly when a foreground display process holds the VM lock, or tell the user to shut down from the guest/display session. Reproduce after a fresh start before proposing a fix.
- **Next step taken:** Shut down macOS inside the VM, then press `Ctrl+C` in the original host Terminal tab running `lume run openclaw`. A final `lume ls` check reported `stopped`.

### Entry 21 — Resuming with a reviewable installer artifact

- **Stage:** Inspecting the official OpenClaw installer before execution
- **Action:** After the host terminal was restarted, checked the VM through Lume's JSON output with the VNC credential filtered out, attempted a passwordless SSH diagnostic, rechecked the current official installation documentation, and downloaded a host-side copy of `https://openclaw.ai/install.sh` without executing it.
- **Expected:** Confirm the VM's current state, preserve the SSH password boundary, and create an independent artifact whose checksum can be compared with a copy downloaded inside the VM.
- **Observed:** The `openclaw` VM was already running headlessly, retained its prior private address, and reported SSH ready. The passwordless diagnostic reached authentication and stopped as intended. The macOS VM guide still proceeds directly to `npm install` even though the fresh VM has no Node or npm, while the general installation and installer-internals pages say the hosted installer provisions Node automatically. At 2026-07-22 15:32 HST, the host-side installer was 114,381 bytes across 3,553 lines with SHA-256 `04ee0149a0833198e96ae02a603215dedab5a4e2dd8f2ae4878f394a05e0db12`. The independently downloaded VM copy matched all three values exactly. Source review confirmed a documented `--dry-run` option, but that path exits after showing only the OS, installation method, requested version, onboarding choice, and dry-run status; it does not enumerate the concrete dependencies, downloads, shell changes, or services a real run would produce. In an interactive terminal, the dry-run path also bootstraps a temporary, checksum-verified `gum` binary from GitHub before displaying the plan; `--no-prompt` suppresses that download.
- **Reaction:** Not yet captured. Chris still needs to decide how useful the available source and dry-run surfaces feel before executing the installer.
- **Evidence:** Read-only Lume JSON filtered to name, status, private address, and SSH readiness; credential-free SSH diagnostic; current official OpenClaw documentation; matching host and VM installer checksums; and the downloaded but unexecuted installer source. VM account names and paths are omitted. The shared terminal transcript also contained VNC session credentials and must be redacted before public use.
- **Severity:** Positive recovery checkpoint plus a reviewability limitation. The installer can be downloaded and inspected, but its dry-run output does not yet answer the original “what will this change?” question.
- **Opportunity hypothesis:** A trust-oriented install plan could derive and present the actual actions for the detected machine—such as whether Homebrew, Node, Git, shell configuration, OpenClaw, onboarding, or a background service would be involved—before mutation. This remains unvalidated until the dry run is observed in the fresh VM and the full relevant source branches are reviewed.
- **Next step taken:** Run the verified local VM copy with `--dry-run --no-prompt --no-onboard`, preventing the optional interface download as well as installation and onboarding changes, and capture whether its plan answers the user's questions.

### Entry 22 — The dry run does not preview the consequential actions

- **Stage:** Previewing the verified installer before allowing changes
- **Action:** From the SSH session inside the fresh VM, ran the downloaded and checksum-matched local installer with `--dry-run --no-prompt --no-onboard`.
- **Expected:** A beginner-accessible explanation of what each choice means and what will happen next. In particular, Chris expected the plan to resolve `latest` to the specific OpenClaw version, explain what a dry run is, and explain the consequences of skipping onboarding.
- **Observed:** The installer detected macOS and displayed an install plan containing five fields: OS `macos`, install method `npm`, requested version `latest`, dry run `yes`, and onboarding `skipped`. It then reported “Dry run complete (no changes made).” It did not inspect or report the fresh VM's known missing Node runtime, whether Homebrew would be installed, whether Git would be installed, the relevant download sources, installation destinations, shell-profile effects, or any later onboarding and daemon consequences. Because `--no-prompt` was supplied, the otherwise interactive temporary `gum` download was also avoided.
- **Reaction:** The output was sufficient for Chris personally to feel comfortable proceeding, but only because he can infer command-line terminology. He questioned how the same output would land for someone who is not comfortable with a terminal and cited Anthropic's CLI experience as a high-quality reference. His conclusion was that the OpenClaw installer needs better explainers: “I would like to know what the requested/latest version is AND what a dry run is. What if I skip onboarding?” He identified this as a contribution lane that fits his hybrid strengths: improving both graphical and command-line interfaces through design judgment plus implementation, beginning with a concrete observed problem rather than a broad redesign.
- **Evidence:** First-hand screenshot of the dry-run output. The VM username, private address, and user-specific paths visible in the screenshot are intentionally omitted here and must be redacted before public use.
- **Severity:** Significant trust friction. The product labels this an install plan and a dry run, but it previews requested options rather than the environment-specific actions the real installer is about to take.
- **Opportunity hypothesis:** Expand dry-run planning so it evaluates prerequisites and reports an ordered, environment-specific action list without mutating the system—for this VM, at minimum the expected Homebrew and Node path, Git check, npm package destination, onboarding choice, and whether a persistent gateway service would be installed. Validate maintainer intent and implementation feasibility before selecting this as the contribution.
- **Next step taken:** Translate the current fields and consequences into plain language, then inspect what the real installer would do on this fresh VM before deciding whether to run it or select the explainer gap as the contribution scope.

### Entry 23 — Anticipating liveness and recovery needs before the real run

- **Stage:** Preparing for the first mutating installer run
- **Action:** Considered how a user can tell whether a long-running CLI installation is still making progress and what control they have if it appears stuck.
- **Expected:** A spinner or loader while work is active, plus a limited way to inspect or poll current status without disrupting the operation.
- **Observed:** Source review shows that the interactive installer temporarily downloads a checksum-verified `gum` binary and uses it for spinner-based steps. It also exposes a separate `--verbose` mode. The actual experience has not yet been observed, so it is unknown whether the spinner identifies the current substep, shows elapsed time or progress, exposes details on demand, distinguishes slow work from a stall, or explains safe cancellation and recovery.
- **Reaction:** Chris identified this as another area where CLI design can reduce uncertainty: “show a spinner or loader if something is doing something or allow you to check limited commands/poll if it feels like its stuck.”
- **Evidence:** First-hand expectation stated before the real install plus local review of the verified installer source.
- **Severity:** Unvalidated until the mutating run is observed.
- **Opportunity hypothesis:** Treat liveness, observability, interruption, and recovery as explicit parts of the installer interaction model. Possible patterns include named stages, elapsed time, optional detail expansion, stall guidance, safe-cancel copy, resumability, and a post-run receipt. Park this adjacent scope until the real run shows which gaps actually occur.
- **Next step taken:** Run the verified installer with onboarding skipped and record the live progress experience without expanding the contribution scope yet.

### Entry 24 — The real run reveals work that the plan omitted

- **Stage:** Beginning the first mutating installer run
- **Action:** Ran the verified VM-local installer with `--no-onboard` in the interactive SSH session.
- **Expected:** Install OpenClaw and its missing prerequisites while preserving onboarding as a separate later decision; observe how the CLI communicates active work and waits for input.
- **Observed:** The installer first reported that it was preparing and verifying spinner support, then displayed a styled banner and confirmed a temporary, verified `gum` v0.17.0 bootstrap. It repeated the same high-level plan, then displayed `[1/3] Preparing environment`. Only after beginning execution did it report that Node.js was missing, Homebrew was missing, and Homebrew would be installed. The process then stopped at a password prompt. One password attempt failed with the standard “Sorry, try again” response, and the installer remained waiting for another attempt. After authentication succeeded, Homebrew completed and the installer advanced to “Installing Node.js via Homebrew.” During the ambiguous wait, additional typed characters and repeated interrupt keystrokes later appeared visibly in the terminal; the screenshot therefore contained a password-like string that must be treated as exposed and is intentionally omitted from this record.
- **Reaction:** The stage counter and named actions demonstrate some of the liveness feedback Chris wanted, but at the password prompt he reported, “right now I don't know what's happening.” The visually unchanged screen looked like an ambiguous stall rather than an explicit user-input wait. The interface did not explain which password was requested, that typed characters would remain invisible, or what would happen after submission. Once the Homebrew and Node messages appeared, Chris understood that installation was active. He refined the desired interaction into a persistent status view showing both the full breakdown of required installations and which item is currently active.
- **Evidence:** First-hand screenshot of the interactive installer at the Homebrew administrator-password prompt. The VM username, private address, and user-specific paths are intentionally omitted and must be redacted before public use.
- **Severity:** Positive progress feedback plus significant input ambiguity and potential credential exposure. The user could not distinguish waiting from working at a consequential authentication step, and extra input entered during that ambiguity later became visible. The main planning gap is also directly confirmed: environment-specific actions appeared only after execution began, even though they were knowable beforehand.
- **Opportunity hypothesis:** Use one persistent checklist across preview, execution, and completion. Detect prerequisites before mutation, show the complete required sequence, mark the active item with visible liveness feedback, make user-input waits explicit, and convert the same checklist into a completion receipt. For example: Homebrew complete, Node.js installing, Git pending or already available, OpenClaw pending, onboarding skipped. This would preserve the existing stage and spinner foundation while making progress and remaining work legible.
- **Next step taken:** Leave the active Node installation undisturbed until it reports a new prompt, success, or error; afterward, rotate the potentially exposed VM password.

### Entry 25 — Installation completes but command readiness remains separate

- **Stage:** Completing the OpenClaw package installation with onboarding deferred
- **Action:** Allowed the verified installer to finish after Homebrew authentication and the Node installation step.
- **Expected:** Install the missing runtime and OpenClaw CLI, leave onboarding untouched, and receive a clear account of the completed changes and next step.
- **Observed:** The installer completed all three numbered stages. Homebrew installed successfully; Homebrew then installed Node.js v24.18.0 with npm 11.16.0. Git was already installed. The installer resolved `latest` to OpenClaw v2026.7.1-2, installed the npm package, and reported OpenClaw installed successfully. It honored `--no-onboard` and supplied the full executable path for running onboarding later. During finalization it warned that npm's global binary directory, `/opt/homebrew/bin`, was missing from the shell's `PATH`, said this could cause `openclaw` to appear as “command not found” in new terminals, and provided separate zsh and Bash profile fixes.
- **Reaction:** “ok its done installing.” No reaction to the repeated `PATH` handoff has yet been captured.
- **Evidence:** First-hand screenshot of the completed installer receipt. The screenshot contains the previously exposed password-like text plus VM identifiers and paths and must be redacted before any public use.
- **Severity:** Positive completion with significant repeated handoff friction. OpenClaw installed successfully and explained the remaining shell configuration, but—like Lume earlier in the same journey—installation success did not mean the short command was ready in future terminals.
- **Opportunity hypothesis:** The persistent checklist should end in a durable receipt that distinguishes installed files from command readiness and configuration readiness. A successful state should either apply and verify the appropriate shell path or present an explicit incomplete item such as “Command setup: action required,” rather than placing it between a warning and a global success message.
- **Next step taken:** Rotate the potentially exposed VM password, then apply the zsh-specific `PATH` fix and verify the OpenClaw version before beginning onboarding.

### Entry 26 — Rotating the exposed VM password leaves a keychain caveat

- **Stage:** Securing the VM after ambiguous hidden input became visible
- **Action:** Ran the macOS `passwd` command in the existing SSH session and completed the hidden old-password, new-password, and confirmation prompts.
- **Expected:** Invalidate the password-like credential visible in the private screenshots before continuing with OpenClaw verification.
- **Observed:** The command returned to the shell without an error, indicating the VM account password changed. It then warned that `passwd` does not update the macOS login keychain password and pointed to `security set-keychain-password` for separately updating that keychain. The warning does not mean the old password remains valid for SSH or administrator authentication, but graphical apps may later prompt to unlock or update the login keychain.
- **Reaction:** Not yet captured. The security recovery succeeded, while introducing a separate macOS credential-store consequence outside OpenClaw's direct scope.
- **Evidence:** First-hand screenshot of the completed `passwd` interaction. Password inputs remained hidden, but older scrollback in the screenshot still contained the previously exposed password-like text; the image must not be published without redaction.
- **Severity:** Positive recovery checkpoint with a minor macOS follow-up. The exposed account password has been rotated; keychain synchronization can be handled separately if the VM later uses keychain-backed graphical apps.
- **Opportunity hypothesis:** None for OpenClaw. Preserve this as evidence that ambiguous terminal wait states can create downstream recovery work even when the underlying password tool behaves correctly.
- **Next step taken:** Clear sensitive terminal scrollback, apply the installer-provided zsh `PATH` fix, reload the profile, and verify the resolved OpenClaw executable and version.

### Entry 27 — Completing command readiness after successful installation

- **Stage:** Verifying that the installed CLI is discoverable by its short command
- **Action:** Applied the installer-provided `/opt/homebrew/bin` zsh path export with an idempotent shell check, sourced the resulting profile, then inspected the resolved executable and ran `openclaw --version`.
- **Expected:** Make the short `openclaw` command available and confirm that it invokes the version installed by the reviewed artifact.
- **Observed:** The initial check reported that `~/.zshrc` did not exist on the fresh VM; the fallback created it with the path export. After sourcing it, `command -v` resolved OpenClaw under `/opt/homebrew/bin`, and the CLI reported `OpenClaw 2026.7.1-2 (0790d9f)`. A separate interactive login-shell invocation produced the same executable path, version, and build identifier, confirming that new zsh sessions inherit the fix.
- **Reaction:** No additional confusion was reported. The missing-file message came from the walkthrough's idempotent check rather than from OpenClaw itself.
- **Evidence:** First-hand terminal output containing the missing-profile message, resolved executable path, exact version, and build identifier. User-specific paths are generalized in the public record.
- **Severity:** Positive recovery checkpoint. Installation, shell discovery, and exact-version verification now work both in the active session and a fresh login shell.
- **Opportunity hypothesis:** The repeated Lume/OpenClaw pattern remains: a successful installer can leave command discovery incomplete. A stronger completion contract would verify a representative fresh shell before declaring the command ready.
- **Next step taken:** Begin the separately deferred onboarding experience and pause at its first consequential trust decision before entering credentials.

### Entry 28 — Conversational onboarding proposes a bundled first setup

- **Stage:** First screen of the separately deferred onboarding flow
- **Action:** Ran `openclaw onboard` after verifying installation and command readiness, then paused without entering a response.
- **Expected:** See the initial setup choices before authorizing configuration or entering any provider credential.
- **Observed:** OpenClaw opened a conversational terminal interface, introduced the local agent, and said there were “No menus” because the user could describe what they wanted. It summarized its machine inspection: no Claude Code or Codex login and no OpenAI or Anthropic API-key environment variables were detected; it proposed a workspace under the user's OpenClaw state directory; and it proposed a local Gateway private to the VM with token authentication. It said it would configure the basics first and ask about a model provider afterward using masked credential prompts. The primary instruction was “Say yes and I'll set all of that up now.” A separate warning said the agent gets “real access” to the machine and linked to the security documentation. The screen also suggested connecting messaging channels after setup.
- **Reaction:** Chris understood the general intent but found the interface confusing and intimidating for a non-engineer. He identified seven issues: the repeated agent/session identifiers above the introduction felt unexplained and oddly placed; the experience lacked the ASCII-art or branded arrival moment associated with established terminal programs; the three machine-inspection bullets did not reveal whether other categories might appear; `yes` did not explain what would be installed, created, changed, or started; “real access” understated how insecure a misconfigured agent could become; and the footer—`local ready`, `idle`, agent/session labels, `unknown`, and `tokens ?`—provided no understandable meaning. He believes these gaps would be substantially harder for the average non-technical user even though he can infer the overall flow.
- **Evidence:** First-hand screenshot of the initial onboarding interface. The screenshot includes VM and generated agent identifiers that should be reviewed before public use; no provider key or token was entered.
- **Severity:** Positive progressive disclosure with an unresolved consent question. The screen explains more environment-specific context than the installer preview, but bundles multiple setup actions behind a single free-form `yes` and provides no visible Details, Customize, or Exit affordance.
- **Opportunity hypothesis:** Preserve the conversational interface while making consent boundaries and available responses explicit. A concise action preview plus visible choices such as Continue, Review changes, Customize, and Exit could support newcomers without removing the natural-language path.
- **Next step taken:** Capture Chris's interpretation and trust reaction before authorizing the proposed setup.

### Entry 29 — Source inspection confirms internal state is exposed without explanation

- **Stage:** Interpreting the first onboarding screen before consent
- **Action:** Downloaded and unpacked the exact installed npm package, OpenClaw 2026.7.1-2, in a temporary host directory and inspected the onboarding and TUI rendering source without changing the VM.
- **Expected:** Determine which overview bullets and status values can appear so the walkthrough does not speculate from a single screenshot.
- **Observed:** Fresh onboarding always renders exactly three overview bullets: AI, Workspace, and Gateway. The AI bullet either reports no detected access or names the first detected inference backend, model reference, and detail; the workspace path is derived from the proposed or configured workspace; the Gateway sentence is fixed as local, private, and token-authenticated. Configured installs receive a different welcome rather than additional bullets. The top header concatenates the TUI title, connection URL, selected agent, and session; the extra line shows the raw session key. In the current footer, `local ready` means the local runtime is connected, `idle` means no activity is running, `unknown` means no model is selected, and `tokens ?` means neither usage nor context-window data is available. Agent and session labels identify the selected execution context. None of those meanings is explained in the interface.
- **Reaction:** The source confirms that Chris's confusion was not caused by overlooking a legend or hidden list on this screen. The UI presents operator diagnostics as primary onboarding chrome before establishing their relevance.
- **Evidence:** Exact-version npm package source, especially the compiled onboarding welcome and TUI header/footer formatters, compared with the first-hand screenshot. Temporary host paths and generated identifiers are omitted.
- **Severity:** Significant comprehension and trust friction for newcomers. The core proposal is understandable, but internal identifiers and undefined status vocabulary compete with the introduction while the most consequential concepts remain compressed into `yes` and “real access.”
- **Opportunity hypothesis:** Establish a clearer onboarding information hierarchy: branded product arrival and plain-language purpose first; proposed changes and security boundary second; advanced agent/session/model/token diagnostics collapsed, labeled, or introduced only when relevant. “Official” should come from consistent identity plus verifiable version, provenance, security posture, and explicit consequences—not decoration alone.
- **Next step taken:** Use the free-form onboarding input to request an exact, non-mutating explanation of planned changes, machine access, customization, and cancellation before granting consent.

### Entry 30 — The pre-consent explanation request cannot be answered without a model

- **Stage:** Testing the onboarding interface's free-form promise before consent
- **Action:** Entered a natural-language request asking OpenClaw to explain exactly which files, settings, and processes it would create, change, or start; what “real access” means; how to customize; and how to cancel or undo. The request explicitly said not to make changes.
- **Expected:** Because the interface said “tell me what you want and I'll do the configuring,” receive a non-mutating explanation of the pending proposal before deciding whether to approve it.
- **Observed:** OpenClaw replied that it could not reach a model and was operating in deterministic mode. It listed a closed set of supported commands—doctor, status, health, Gateway checks/restarts, agent/model lists, model-provider configuration, default-model selection, channel connection, audit, and switching to the agent TUI—but did not answer any part of the explanation request or point to a supported command for reviewing the pending plan. No changes were applied. Exact-version source inspection confirmed that, without a usable model, arbitrary input falls through to this fixed response unless it matches an anchored command grammar. The original setup proposal remains pending, so a later bare `yes` would still approve it.
- **Reaction:** The result directly contradicts the initial “No menus” natural-language promise at the moment a newcomer most needs clarification. The interface looks conversational before a model exists but cannot explain its own deterministic setup operation.
- **Evidence:** First-hand screenshot of the deterministic fallback plus exact-version source for the fallback router, pending-proposal logic, setup plan, and setup application path.
- **Severity:** Blocker for informed consent through the advertised interaction model. A user cannot ask what the pending setup will do until after configuring the model that setup is meant to help them configure.
- **Opportunity hypothesis:** The pre-model experience needs a deterministic `details`, `review plan`, or `what will you change?` path backed by the same structured operation plan used for execution. Natural-language copy should not imply open-ended understanding when only a closed grammar is available; visible supported actions or a menu are more honest and more usable.
- **Next step taken:** Keep the pending proposal unapproved while reviewing the exact setup mutations recovered from source.

### Entry 31 — Source review reveals materially more setup than `yes` explains

- **Stage:** Establishing the true consent boundary before onboarding mutation
- **Action:** Traced the exact 2026.7.1-2 setup operation from the pending proposal through its non-mutating preview and approved application paths.
- **Expected:** Determine what a bare `yes` would authorize so Chris can make an informed decision and the journey can compare displayed versus actual consequences.
- **Observed:** The built-in preview describes only bootstrapping the workspace and, when available, a model choice. The approved path does substantially more: it writes the OpenClaw configuration; applies the local workspace; records a security-acknowledgement timestamp; configures quickstart Gateway settings including local bind and authentication; writes onboarding metadata; creates the workspace, sessions, and bootstrap files; records full execution permission with approval prompts off for the setup agent; and, on the CLI surface, attempts to install and start the managed Gateway service before probing it for reachability. With no detected model, it then offers guided model-provider setup. These actions are knowable from the same deterministic code path but are not disclosed by the initial `yes` prompt.
- **Reaction:** This validates Chris's concern that “real access” is understated and that `yes` needs a concrete action breakdown. The consent copy omits both persistent files and a background service, as well as the setup agent's execution posture.
- **Evidence:** Exact-version compiled source for the onboarding welcome, operation formatter, setup executor, and setup-application module, cross-checked against official onboarding and security documentation.
- **Severity:** High-confidence informed-consent gap. The proposed defaults may be intentional and locally scoped, but the breadth and persistence of the approved changes are not represented at the decision point.
- **Opportunity hypothesis:** Generate preview, live progress, receipt, and undo guidance from one structured setup plan. At minimum, disclose configuration path, workspace/bootstrap files, Gateway bind/auth, managed service installation/start, agent execution posture, model state, and the security acknowledgement being recorded.
- **Next step taken:** Decide explicitly whether to decline the current proposal or approve it now that its actual effects are understood.

### Entry 32 — Declining clears the proposal without leaving onboarding

- **Stage:** Exercising the first consent-recovery path
- **Action:** Entered `no` while the original setup proposal remained pending.
- **Expected:** Clear the bundled setup proposal without writing configuration, starting the Gateway, or leaving the onboarding interface.
- **Observed:** OpenClaw responded, “Skipped. No barnacles on config today.” The TUI remained open in local-ready, idle, model-unknown state. No model or token usage appeared, and no alternative next actions were shown after the decline.
- **Reaction:** Not yet captured. Chris shared the resulting screen without additional commentary.
- **Evidence:** First-hand screenshot of the decline response and unchanged status footer. No credential was entered.
- **Severity:** Positive consent control with minor recovery ambiguity. The user can decline cleanly, but must already know the deterministic command vocabulary to continue productively.
- **Opportunity hypothesis:** After decline, confirm the concrete effect—“No files changed; Gateway not installed or started”—and offer visible next actions such as Review plan, Configure model only, Customize setup, or Exit.
- **Next step taken:** Start the deterministic model-provider setup separately and pause at its first screen before entering any credential.

### Entry 33 — The dedicated provider picker restores clear affordances

- **Stage:** Configuring inference separately from the bundled setup
- **Action:** Entered the supported deterministic command `configure model provider` after declining the original proposal.
- **Expected:** Open a credential-safe provider flow and inspect its choices before selecting or authenticating.
- **Observed:** The TUI said it was opening masked model-provider setup, then displayed a bordered single-choice menu titled **Model/auth provider**. The visible choices were OpenAI, Anthropic, xAI (Grok), Google, OpenRouter, Meta, **More…**, and **Skip for now**. OpenAI was selected by default and described as supporting ChatGPT/Codex sign-in or an API key. The footer explicitly taught the arrow-key navigation and Enter confirmation controls. No credential was requested or entered on this screen.
- **Reaction:** Not yet captured. The screen provides substantially clearer affordances than the preceding “No menus” onboarding proposal.
- **Evidence:** First-hand screenshot of the provider picker. No provider credential, OAuth code, or token is visible.
- **Severity:** Positive interaction checkpoint. The menu bounds the decision, describes at least one provider's auth options, exposes additional providers progressively, offers a safe skip, and explains its controls.
- **Opportunity hypothesis:** Reuse this established menu and masked-wizard interaction language for the initial onboarding consent layer rather than presenting an apparently open-ended conversation before inference exists.
- **Next step taken:** Inspect the OpenAI branch without completing authentication or sharing any credential.

### Entry 34 — Subscription authentication succeeds but leaves sensitive callback data in the transcript

- **Stage:** Connecting an existing ChatGPT/Codex subscription from a remote VM
- **Action:** Selected OpenAI, chose **ChatGPT Login**, opened the generated authorization URL in the host Mac's browser, completed sign-in, and pasted the resulting redirect URL into the VM terminal.
- **Expected:** Authenticate the VM-local OpenClaw installation against the existing subscription without creating or entering an API key.
- **Observed:** OpenClaw recognized the remote environment and explained that the authorization URL should be opened in a local browser. It accepted either an authorization code or the complete redirect URL. After the redirect was pasted, it installed the Codex plugin and set the default model to `openai/gpt-5.6-sol`. The next screen offered **Keep current**, **Enter model manually**, and **Browse all models**. The successful terminal transcript still contained the pasted callback URL, including a short-lived authorization code and state value.
- **Reaction:** Authentication and default-model selection were understandable and completed successfully. Sharing the resulting terminal transcript created a new redaction requirement because the callback data looked like ordinary setup output after success.
- **Evidence:** First-hand terminal transcript. The authorization URL, callback URL, authorization code, state value, account information, and any derived credential are intentionally excluded and must not appear in screenshots, PR artifacts, or the public case study.
- **Severity:** Positive authentication checkpoint with significant transcript-sharing risk. No reusable API key or access token was displayed, and the successful exchange indicates the authorization code had already been consumed, but the transcript should still be treated as sensitive.
- **Opportunity hypothesis:** After a successful OAuth exchange, replace or clear the submitted callback value in the interactive transcript and end with a redacted receipt. At minimum, warn users not to share the authorization screen or terminal transcript. Verify current input-rendering behavior and the responsible source before selecting this as a contribution.
- **Next step taken:** Keep `openai/gpt-5.6-sol` as the default model and continue to the next setup decision without sharing further authentication output.

### Entry 35 — The offered Gateway diagnostic repeats the symptom

- **Stage:** Recovering from the first post-authentication Gateway failure
- **Action:** Entered the suggested deterministic command `gateway status` after OpenClaw reported that the local Gateway was not reachable.
- **Expected:** Learn whether the managed Gateway service was never installed, was installed but stopped, had failed to start, or was listening somewhere unexpected, then receive an appropriate recovery step.
- **Observed:** The response stated only that the Gateway was not reachable at the same local WebSocket address and that the connection attempt failed. It did not report installation state, service state, process state, logs, or a condition-specific next action. The footer remained local-ready and idle with the configured OpenAI model visible.
- **Reaction:** The diagnostic repeated the symptom rather than explaining the system state. Restarting remained available, but there was still not enough information to know whether restart was the correct operation.
- **Evidence:** First-hand terminal transcript from OpenClaw v2026.7.1-2. Exact-version source inspection shows that the conversational `gateway status` operation reloads the same overview and formats its reachability fields instead of invoking the CLI's deeper managed-service status command. Current upstream `main` retains the same operation shape. User-specific paths and connection details are excluded from this record.
- **Severity:** Significant recovery friction. The user followed the interface's recommended diagnostic path but did not gain the information needed to choose a repair.
- **Opportunity hypothesis:** Route conversational `gateway status` through the existing Gateway status diagnostics, or return a concise service-state summary with a safe command for deeper detail. Preserve the deterministic, non-mutating behavior while distinguishing not installed, stopped, running but unreachable, and probe failure states.
- **Next step taken:** Keep the TUI open, start a second SSH session, and run the read-only CLI command `openclaw gateway status --deep` to establish the actual service state before approving any restart.

### Entry 36 — Deep status identifies an uninstalled service and the correct recovery

- **Stage:** Establishing the actual Gateway service state
- **Action:** Opened a second SSH session in the VM and ran `openclaw gateway status --deep`.
- **Expected:** Distinguish an absent service from a stopped or failed service before making a lifecycle change.
- **Observed:** The CLI reported a LaunchAgent that was not loaded, an unknown runtime, a refused loopback connection, and no service unit. It explicitly concluded that the service was not installed and recommended `openclaw gateway install`. It also supplied the active config location, loopback bind and port, log location, a broader status command, and the troubleshooting documentation.
- **Reaction:** The deeper command supplied the missing diagnosis and a condition-specific recovery. It demonstrated that the preceding TUI suggestion to restart was not appropriate for the actual state.
- **Evidence:** First-hand output from OpenClaw v2026.7.1-2 plus current upstream source for conversational Gateway status and managed-service diagnostics. User-specific paths are generalized here.
- **Severity:** Positive diagnostic recovery after significant TUI friction.
- **Opportunity hypothesis:** Reuse the existing managed-service state and recovery classification in the conversational operation. The minimal user-facing fix may be to distinguish `not installed` and recommend install instead of restart. A broader replacement of the shallow overview with the complete status command needs owner-boundary and output-format review.
- **Next step taken:** Review the exact persistent effects and reversal controls of `openclaw gateway install` before installing the per-user LaunchAgent.

### Entry 37 — Headless service installation fails after making persistent changes

- **Stage:** Installing the managed Gateway from the headless VM session
- **Action:** Ran `openclaw gateway install` from the second SSH session after reviewing its intended persistent effects.
- **Expected:** Set the local Gateway configuration, establish token authentication, write and load a per-user macOS LaunchAgent, start the Gateway, and return a verifiable receipt.
- **Observed:** OpenClaw first reported that it set the missing `gateway.mode` to `local`. It then generated a Gateway token and saved it to config. LaunchAgent activation failed with macOS bootstrap error 125 because the VM user had no logged-in GUI session. The error explained that a per-user LaunchAgent requires that GUI domain, recommended signing into the desktop and rerunning with `--force`, suggested auto-login for headless VMs, and linked to Gateway documentation. Source inspection shows that config and token persistence occur before service installation, and the LaunchAgent file is written before the bootstrap attempt.
- **Reaction:** The failure explanation was materially better than the conversational status response, but “install failed” did not mean “no changes made.” The operation left security- and lifecycle-relevant partial state that now needs inspection.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2, current official Gateway documentation, and current upstream install and LaunchAgent source. No generated token or config contents were shared.
- **Severity:** Significant partial-failure and recovery friction. The user must understand both the GUI-session prerequisite and the changes that succeeded before the reported failure.
- **Opportunity hypothesis:** Add a preflight check for the required macOS GUI domain before persistent config, token, or service-file writes. If late failure remains possible, print a structured partial-change receipt and exact recovery or rollback choices. Also clarify the supported foreground path for headless evaluation before recommending auto-login.
- **Next step taken:** Inspect the post-failure service file and non-secret Gateway settings before choosing a visible foreground Gateway run or a GUI-session-backed LaunchAgent retry.

### Entry 38: The model role is understandable, but the Gateway role is not

- **Stage:** Building a mental model after provider authentication
- **Action:** Reviewed the post-failure service state and explained the current understanding of the model, VM, TUI, and terminal sessions.
- **Expected:** Understand the major OpenClaw components well enough to predict why each one is needed and where it runs.
- **Observed:** The role of the model was intuitive as the reasoning engine OpenClaw can use. The role of the Gateway remained unclear. The two Terminal tabs also appeared to represent different machines, even though both active sessions were SSH connections to the same VM. One was running the OpenClaw TUI and the other was an ordinary VM shell.
- **Reaction:** Chris could describe the VM boundary and the TUI versus shell distinction, but could not yet explain what the Gateway adds or why it should be a background service.
- **Evidence:** First-hand reflection immediately after verifying that the LaunchAgent file existed, local mode and token authentication had been written, and no Gateway process was reachable.
- **Severity:** Significant comprehension gap. The user can follow commands but cannot yet predict the system's behavior or make informed lifecycle choices.
- **Opportunity hypothesis:** Introduce the setup architecture in plain language at the point where the model becomes ready. Explain the interface, local runtime, Gateway, agent, session, workspace, model, and channels as distinct roles. Use a small diagram only if it materially clarifies where each process runs and which capabilities require the Gateway.
- **Next step taken:** Establish a shared component model before removing the failed service definition or starting a visible foreground Gateway.

### Entry 39: Removing the incomplete service preserves a recoverable boundary

- **Stage:** Cleaning up the partial managed-service installation
- **Action:** Ran `openclaw gateway uninstall` after confirming that the LaunchAgent file existed but was not loaded.
- **Expected:** Remove only the incomplete managed-service definition while retaining the OpenClaw config, provider authentication, selected model, and local Gateway settings.
- **Observed:** OpenClaw moved the LaunchAgent property list into the VM user's Trash and returned to the shell. It did not report removing config, model authentication, or workspace data.
- **Reaction:** The removal action was short, explicit, and recoverable. It provided a clearer outcome than the failed installation.
- **Evidence:** First-hand terminal output. The user-specific Trash path is generalized here.
- **Severity:** Positive recovery checkpoint.
- **Opportunity hypothesis:** Preserve this specific and recoverable language in future setup receipts. A partial-install failure could offer this cleanup operation directly when activation fails.
- **Next step taken:** Start the Gateway as a visible foreground process so its runtime behavior can be observed before deciding whether to install automatic background supervision.

### Entry 40: Foreground startup makes the Gateway concrete and reveals implicit trust behavior

- **Stage:** Starting the first working Gateway process
- **Action:** Ran `openclaw gateway --port 18789` in the second VM SSH session after removing the incomplete LaunchAgent.
- **Expected:** Keep the Gateway attached to a visible terminal, observe its startup stages, and avoid automatic background persistence.
- **Observed:** The Gateway loaded configuration, resolved authentication, started its HTTP server, initialized health monitoring, selected `openai/gpt-5.6-sol`, loaded ten plugins, started channels and sidecars, and reported ready. Startup also refreshed the configured Codex plugin through a Doctor repair. Because `plugins.allow` was empty, OpenClaw warned that the discovered non-bundled Codex plugin could auto-load and suggested explicit inspection or allow-listing. The bundled Bonjour plugin advertised the Gateway hostname and port through mDNS. The process remained attached to the shell.
- **Reaction:** The visible startup sequence made the Gateway understandable as a long-running application server rather than an abstract setup requirement. It also exposed additional automatic behavior that had not been part of the earlier install plan: plugin repair, non-bundled plugin auto-loading, and local-network discovery.
- **Evidence:** First-hand foreground logs from OpenClaw v2026.7.1-2 plus current official Gateway, plugin, Bonjour, and security documentation. User-specific paths and hostnames are generalized here.
- **Severity:** Positive learning checkpoint with trust-relevant configuration questions.
- **Opportunity hypothesis:** A first-run Gateway receipt could distinguish required core startup from automatic repair, third-party plugin trust, and network discovery. Setup should make explicit whether Bonjour advertising and non-bundled plugin discovery are enabled, especially in an isolated or security-conscious evaluation.
- **Next step taken:** Leave the foreground Gateway running, verify RPC health from a third VM shell, then inspect the Codex plugin and Bonjour configuration without changing them.

### Entry 41: Foreground health is good, but status mixes service and process state

- **Stage:** Verifying the visible foreground Gateway
- **Action:** Opened a third SSH session to the VM and ran `openclaw gateway status --require-rpc`.
- **Expected:** Prove that the Gateway accepted a connection and supported read-scope RPC operations.
- **Observed:** The command reported matching CLI and Gateway versions, a successful read probe, and listeners on the configured loopback port. It also reported an unloaded and absent LaunchAgent, an unknown managed runtime, and no service unit. Those service statements were expected because the Gateway was running as an unmanaged foreground process. The installed release displayed the internal capability value `connected-no-operator-scope`; current upstream formats that state as `connect-only`.
- **Reaction:** The Gateway was healthy enough for read diagnostics, but the output required prior knowledge to reconcile “service not installed,” “runtime unknown,” and an active listener.
- **Evidence:** First-hand screenshot from OpenClaw v2026.7.1-2, current CLI documentation, exact-version package source, and current upstream capability formatting source. User-specific hostnames, paths, and private addresses are excluded.
- **Severity:** Positive health checkpoint with moderate status-model ambiguity.
- **Opportunity hypothesis:** Treat managed-service state, live-process state, and RPC capability as three explicitly labeled layers. Do not pursue the raw capability wording as a new contribution because current upstream already improves that label.
- **Next step taken:** Inspect the auto-loaded Codex plugin provenance and current Bonjour configuration without changing either.

### Entry 42: Plugin and discovery trust are implicit until inspected

- **Stage:** Reviewing the first working Gateway's trust settings
- **Action:** Ran `openclaw plugins inspect codex`, then queried `plugins.allow` and `discovery.mdns.mode`.
- **Expected:** Establish where the Codex plugin came from, whether it was explicitly trusted, and whether local-network discovery was intentionally enabled.
- **Observed:** Codex was loaded from the official `@openclaw/codex` npm package with a recorded install source and version. It supplies text inference, media understanding, and web search capabilities. Neither `plugins.allow` nor `discovery.mdns.mode` existed in authored config, so both behaviors came from defaults. Official documentation says an empty plugin allow list permits discovered non-bundled plugins to auto-load, while the bundled Bonjour plugin auto-starts on macOS in minimal mDNS mode.
- **Reaction:** The inspection commands made provenance and capability visible, but only after startup had already repaired and loaded the plugin and announced the Gateway.
- **Evidence:** First-hand plugin inspection and config queries, plus current official plugin, Bonjour, and security documentation. Plugin installation paths are intentionally excluded.
- **Severity:** Significant trust-default discovery with strong recovery controls.
- **Opportunity hypothesis:** Surface provider-plugin provenance, the effective plugin trust policy, and local discovery mode before first Gateway startup. Existing inspection, allow-list, and mDNS configuration mechanisms can support the flow without creating new policy surfaces.
- **Next step taken:** Dry-run an explicit Codex allow list and disabled mDNS mode before applying either setting.

### Entry 43: Config dry-run validates changes but does not explain them

- **Stage:** Previewing explicit plugin trust and network-discovery settings
- **Action:** Dry-ran a Codex-only `plugins.allow` value and `discovery.mdns.mode` set to `off` using strict JSON parsing.
- **Expected:** Confirm that both values fit the active schema and understand the exact before and after state, runtime effect, and restart requirement before writing the config.
- **Observed:** Each command reported that one update was successfully validated against the OpenClaw config. Neither command wrote the file. The output did not name the changed path, show the previous or proposed value, explain the behavioral effect, or state whether applying it would require a Gateway restart.
- **Reaction:** The config dry-run provides meaningful validation that the installer dry-run lacked, but its receipt still requires the user to remember and interpret the command.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2 and current config CLI documentation and source.
- **Severity:** Positive safety control with minor explanation friction.
- **Opportunity hypothesis:** Standardize dry-run receipts around path, current value or inherited default, proposed value, validation performed, runtime consequence, and restart requirement. This may be a shared CLI pattern rather than an installer-only fix.
- **Next step taken:** Apply the two validated settings, validate the complete config, and read back only those non-secret paths.

### Entry 44: Applied config receipts explain runtime consequences

- **Stage:** Making plugin trust and network discovery explicit
- **Action:** Set `plugins.allow` to the inspected Codex plugin and set `discovery.mdns.mode` to `off`, then validated the full config and read both values back.
- **Expected:** Persist the two reviewed choices, preserve a valid config, and learn whether the live Gateway needed to restart.
- **Observed:** OpenClaw named each updated path. It said the plugin allow-list change would apply without a Gateway restart and that the mDNS change required a restart. Full config validation succeeded. Read-back returned the Codex-only array and `off`.
- **Reaction:** The applied-change receipts were more informative than the dry-run receipts because they identified each path and its runtime consequence.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2. Only non-secret config paths and values were displayed.
- **Severity:** Positive control and verification checkpoint.
- **Opportunity hypothesis:** Reuse the applied-write receipt's path and restart language in dry-run output, adding current and proposed values where safe.
- **Next step taken:** Restart the visible foreground Gateway and confirm that the empty-allow-list warning and Bonjour advertisement no longer appear.

### Entry 45: The explicit plugin allow list reduced the active capability set

- **Stage:** Restarting the foreground Gateway after config changes
- **Action:** Stopped the foreground Gateway with `Ctrl+C`, restarted it on the same loopback port, and compared the new startup output with the prior run.
- **Expected:** Remove the warning about an empty plugin allow list and stop Bonjour from advertising the Gateway on the local network.
- **Observed:** The Gateway stopped cleanly and restarted successfully. The warning and Bonjour advertisement were gone. The prior run loaded ten plugins. The restarted Gateway loaded only the Codex plugin. Current OpenClaw documentation describes a non-empty `plugins.allow` value as an exclusive plugin allow list. It applies to bundled plugins as well as installed plugins. OpenClaw also reported that it enabled Codex for the current runtime because the configured model requires it, without writing another config change.
- **Reaction:** The security intent succeeded, but the setting had a broader capability effect than I first understood. I had treated the value as a trust list for the inspected non-bundled plugin. It is also a capability boundary.
- **Evidence:** First-hand before and after Gateway startup output from OpenClaw v2026.7.1-2. Current source and official plugin documentation confirm that `plugins.allow` is exclusive and does not get bypassed by broader tool policy.
- **Severity:** Important security and capability tradeoff with a clear recovery path.
- **Opportunity hypothesis:** Before applying a restrictive plugin allow list, preview which currently available plugins will load, which will stop loading, and which configured features require excluded plugins.
- **Next step taken:** Keep the minimal Codex-only runtime for the first controlled task. Add other plugins only after inspecting their purpose and deciding that the task requires them.

### Entry 46: Deep security audit mixes applicable risks, conditional guidance, and an authorization failure

- **Stage:** Inspecting the permission and attack-surface layer
- **Action:** Ran `openclaw security audit --deep` from a separate VM shell while the foreground Gateway was running.
- **Expected:** Receive a prioritized explanation of current access, active protections, approval requirements, and actionable risks.
- **Observed:** The audit reported zero critical findings, three warnings, and one informational attack-surface summary. It warned about missing trusted proxies even though the Gateway remains loopback-only and no reverse proxy is configured. It identified the unpinned `@openclaw/codex` install specification. Its deep Gateway probe failed because the credential lacked `operator.read` scope. The attack-surface summary reported no open groups, enabled elevated tools, disabled webhooks and internal hooks, disabled browser control, and a personal-assistant trust model. The output also suggested running the deep audit even though the command already included `--deep`.
- **Reaction:** The audit exposed useful security state without changing anything. The results still require technical interpretation to distinguish a current risk, a conditional future risk, a supply-chain hardening option, and an authorization limitation in the audit itself. `tools.elevated: enabled` is especially important but is not explained in the summary.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2. Secret values were not displayed or recorded.
- **Severity:** Useful safety checkpoint with significant interpretation friction.
- **Opportunity hypothesis:** Group audit findings by current exposure, conditional exposure, and verification limitation. Explain the practical consequence of each attack-surface field. Suppress redundant “run deeper” guidance when deep mode is already active.
- **Next step taken:** Pause without applying fixes. Resume by verifying the meaning and effective policy of elevated tools, then investigate why the audit probe lacks `operator.read`.

### Entry 47: Sandbox explanation mixes active runtime state with inactive fallback policy

- **Stage:** Inspecting the effective permission boundary for the Crestodian session
- **Action:** Ran `openclaw sandbox explain --session agent:crestodian:main`.
- **Expected:** Learn where this session can execute commands, which workspace it can access, which tools are active, and whether elevated execution is available.
- **Observed:** The session uses the direct runtime with sandbox mode off. The VM is therefore the current containment boundary. The output also displayed `workspaceAccess: none`, a Docker backend, a sandbox allow and deny list, and sandbox fix paths even though the session is not sandboxed. It separately reported elevated mode as globally enabled but `allowedByConfig: false` for the unknown channel. Current documentation says elevated mode affects only `exec`, does not add tools, does not override tool policy, may still require approval, and is effectively a no-op for a direct runtime.
- **Reaction:** The command contains the facts needed to understand the policy, but active state and hypothetical sandbox state require expert interpretation. `workspaceAccess: none` can sound like the agent has no workspace access even though the same output identifies a direct host workspace.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2, plus current official sandbox, tool-policy, and elevated-mode documentation.
- **Severity:** Significant permission-comprehension friction.
- **Opportunity hypothesis:** Present active controls first. Label inactive sandbox policy as “would apply if sandboxed.” Explain direct runtime as execution on the Gateway host and state that sandbox workspace access is currently inapplicable.
- **Next step taken:** Inspect the local host exec approval policy without changing it.

### Entry 48: Fresh local setup defaults host execution to full with approval prompts off

- **Stage:** Inspecting command-execution approval policy
- **Action:** Ran `openclaw approvals get` inside the VM.
- **Expected:** Learn whether shell commands are denied, restricted to an allow list, or presented for approval.
- **Observed:** No local approvals file existed. There were no defaults, agents, or allow-list entries in local approval state. OpenClaw reported an effective `tools.exec` policy of `security=full` and `ask=off`, inherited from OpenClaw defaults. `askFallback=deny` was present but does not trigger while asking is off. This policy matters only if the agent's effective tool policy exposes `exec`.
- **Reaction:** The dedicated VM limits host impact, but the default execution posture is broader than the controlled setup approach I expected. If `exec` is available, the agent can run commands as the VM user without an approval prompt.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2. Current official exec-approval documentation and exact installed CLI code confirm the default fields and the behavior of the `cautious` and `deny-all` presets.
- **Severity:** Important permission default with a clear hardening path.
- **Opportunity hypothesis:** Summarize the effective outcome in plain language, such as “Agents with shell access can run any command on this VM without asking.” During local onboarding, make the execution posture an explicit choice with task-oriented consequences.
- **Next step taken:** Decide whether VM-level containment is sufficient for this learning session, then apply a reviewed execution preset before the first agent task.

### Entry 49: Accepted unrestricted VM execution as an explicit disposable-environment choice

- **Stage:** Choosing the containment and approval posture for the first agent task
- **Action:** Compared an additional Docker sandbox and cautious exec approvals with the purpose of the dedicated Lume VM.
- **Expected:** Select a boundary that matches the learning goal without adding infrastructure that obscures OpenClaw's behavior.
- **Observed:** The VM contains no personal project files and is intended to be disposable. Rebuilding it is an acceptable recovery cost. The operator therefore accepted direct VM execution with the current full, no-prompt exec policy for this experiment. This choice does not remove risks to credentials stored inside the VM, external accounts the agent can reach, outbound network access, model usage, or other reachable systems.
- **Reaction:** VM-level containment is sufficient for this controlled walkthrough. The important difference is that unrestricted execution is now a reviewed choice rather than an unexplained default.
- **Evidence:** First-person risk decision based on the verified effective sandbox and exec-approval output.
- **Severity:** Accepted experimental risk.
- **Opportunity hypothesis:** Onboarding should distinguish disposable evaluation, cautious local use, and trusted full-access operation. Each choice should state what can be lost or reached.
- **Next step taken:** Leave the exec policy unchanged, verify which tools Crestodian actually receives, and run one reversible task inside the VM.

### Entry 50: Local TUI advertises a runtime command that it refuses to run

- **Stage:** Verifying Crestodian's effective runtime tools
- **Action:** Entered `/tools verbose` in the local embedded TUI after confirming that the Gateway had become reachable.
- **Expected:** Receive the effective tool inventory described by the installed command registry.
- **Observed:** The TUI responded that `/tools` is not available in local embedded mode and did not send the message. Current source confirms that shared text commands are intercepted and refused in local mode. The same TUI could report that the Gateway was reachable, but it remained a local embedded session and did not switch transports automatically.
- **Reaction:** The interface exposes one command vocabulary without clearly identifying which commands require a Gateway-backed session. Gateway reachability and TUI transport are separate states, but the footer does not explain the consequence beyond `local`.
- **Evidence:** First-hand terminal output from OpenClaw v2026.7.1-2, exact installed command registry, and current TUI command-handler source.
- **Severity:** Moderate command-discovery and runtime-mode friction.
- **Opportunity hypothesis:** Mark Gateway-only commands in help and completion. When one is entered locally and a Gateway is reachable, explain how to reopen or switch to Gateway-backed mode instead of only refusing the command.
- **Next step taken:** Exit the local TUI, open a Gateway-backed TUI, and retry `/tools verbose`.

### Entry 51: Local Gateway status conflicted with listener and log evidence

- **Stage:** Switching from the local TUI to a Gateway-backed TUI
- **Action:** Asked for Gateway status in the local TUI, opened `openclaw tui`, ran `openclaw gateway status --require-rpc`, checked the port listener, and read the configured file log.
- **Expected:** Connect the TUI to the foreground Gateway that the local TUI had just reported as reachable.
- **Observed:** The Gateway-backed TUI remained disconnected. Deep status reported an abnormal WebSocket closure. No process was listening on port 18789. The file log showed that the foreground Gateway had received `SIGINT` and completed a clean shutdown at 18:42, with no later startup. The local TUI had nevertheless changed from “not reachable” to “reachable.” The file-log fallback also included output from later standalone security, sandbox, and approval commands, not only live Gateway activity.
- **Reaction:** The listener and chronological log provide a clear explanation: no Gateway process is currently running. The local TUI's reachability statement was stale, inferred, or otherwise inconsistent with the live runtime. The generic abnormal-closure diagnosis delayed that conclusion.
- **Evidence:** First-hand TUI, status, `lsof`, and file-log output from OpenClaw v2026.7.1-2. Current source verification is still required before assigning the local TUI status discrepancy to a specific implementation.
- **Severity:** Significant runtime-state and recovery friction.
- **Opportunity hypothesis:** Make status reports timestamped and identify their evidence source. When no listener exists, lead with “Gateway is not running” instead of generic WebSocket causes. Distinguish live Gateway logs from the broader local application log.
- **Next step taken:** Start one visible foreground Gateway in a dedicated SSH tab, verify the listener, then open one Gateway-backed TUI.

### Entry 52: Gateway-backed tool inventory reveals a full-capability default agent

- **Stage:** Verifying the tools the working Gateway-backed agent can actually invoke
- **Action:** Started one foreground Gateway, opened `openclaw tui`, and ran `/tools verbose`.
- **Expected:** Replace configuration-based inference with the effective runtime inventory.
- **Observed:** The connected session is `agent:main:main`, not the local Crestodian session. It uses tool profile `full`. Available built-in tools include shell execution and process control; file read, write, edit, and patch; Gateway config, restart, and update; cron; nodes; messaging; sessions and subagents; goals and plans; web fetch and search; TTS; and other runtime controls. Connected memory search and exact memory reads are also present. Availability does not prove that an external target such as a node or messaging channel is configured.
- **Reaction:** The inventory finally makes the capability surface visible in one place. Combined with direct runtime, sandbox mode off, and effective exec policy `security=full, ask=off`, an available `exec` call can run commands as the VM user without approval. File and Gateway mutation capabilities are also exposed independently of `exec`.
- **Evidence:** First-hand `/tools verbose` output from the Gateway-backed TUI in OpenClaw v2026.7.1-2, combined with the previously verified sandbox and approval output.
- **Severity:** Important informed-consent discovery.
- **Opportunity hypothesis:** Summarize effective capabilities by consequence before listing implementation-level tools: files, shell, network, persistent schedules, configuration, external devices, messages, and delegation. Distinguish “tool exposed” from “external target configured.”
- **Next step taken:** Enable visible tool-call output and run one reversible workspace-only task with an explicit tool boundary.

### Entry 53: First controlled task mutated before receiving its constraints and failed verification

- **Stage:** Running and independently verifying the first agent task
- **Action:** Asked the Gateway-backed agent to create a workspace file with exact content, use only Write and Read, avoid all external and administrative tools, read the result back, and report its path and tool use. Enabled verbose tool output and verified the file later from a separate VM shell.
- **Expected:** One Write call, one Read call, an exact six-line file, no other mutations, and a receipt matching the visible tool trace.
- **Observed:** The transcript shows that the opening creation sentence arrived as one turn and triggered an immediate Apply Patch call before the remaining constraints arrived. A later turn triggered a second Apply Patch call. The agent reported Tool Search and Apply Patch, explained that Write and Read were unavailable to the selected model harness, and did not claim to have completed the requested read-back. Independent shell verification found the correct workspace path but a twelve-line file. It included the operational instructions that were supposed to remain outside the exact file content. No shell, network, Gateway, cron, messaging, node, session, or delegation call appeared in the visible trace.
- **Reaction:** Creating a file is not sufficient proof of task success. The turn boundary changed the instruction sequence, the requested tool names did not match the model-facing tool surface, and the resulting artifact failed exact-content verification.
- **Evidence:** First-hand TUI transcript, verbose tool trace, `sed` output, and `wc` output from OpenClaw v2026.7.1-2. Current official Codex harness documentation confirms that native Codex workspace operations replace duplicate OpenClaw Read, Write, Edit, Apply Patch, Exec, and Process tools, while other tools may be deferred through Tool Search.
- **Severity:** Significant task-submission, tool-transparency, and verification friction.
- **Opportunity hypothesis:** Preserve multiline pasted instructions as one reviewable message. Distinguish effective OpenClaw capabilities from the model-facing harness tool surface. Provide a task receipt that separates requested constraints, observed tool calls, resulting artifacts, and unverified claims.
- **Next step taken:** Retry the same artifact correction as one single-line message using the observed native Apply Patch tool, then verify the file independently again.

### Entry 54: Single-turn retry produced a verified exact artifact

- **Stage:** Retrying the first controlled task with the observed model-facing tool
- **Action:** Sent one correction request that named the existing file, specified each of six required lines, limited the task to Apply Patch, prohibited other mutations, and requested a minimal receipt.
- **Expected:** One Apply Patch call, an exact six-line artifact, no other observed tools, and a final response containing only the path and tool used.
- **Observed:** The verbose trace showed one Apply Patch call against the intended workspace file. The final response contained the correct path and `Apply Patch`. Independent shell verification showed the exact heading and four bullet lines, with six total lines and 173 bytes. An extra paste-handling reminder was included in the user request but did not enter the artifact.
- **Reaction:** The retry is a working proof. The scope was understandable to the selected harness, tool activity was visible, the receipt was concise, and independent verification matched the reported result.
- **Evidence:** First-hand Gateway-backed TUI trace plus independent `sed` and `wc` output from the VM.
- **Severity:** Positive recovery and verification checkpoint.
- **Opportunity hypothesis:** Use this interaction as a reference pattern for constrained task UX: one submitted scope, visible tool activity, a concise completion receipt, and an independently verifiable artifact.
- **Next step taken:** Close the first-task learning milestone and triage the documented friction against current upstream code and contribution conventions.

### Entry 55: Persistence was easier to understand through direct inspection than recall

- **Stage:** Returning to the walkthrough after the first controlled task
- **Action:** Checked Gateway RPC reachability, the loopback listener, stored sessions, and the controlled workspace artifact.
- **Expected:** The foreground Gateway would still be reachable, and disk-backed session and workspace state would remain available.
- **Observed:** The Gateway read probe succeeded. One Node process listened on the configured IPv4 and IPv6 loopback addresses. The `agent:main:main` session remained in the session store after 18 hours. The exact six-line workspace artifact remained on disk.
- **Reaction:** The evidence clarified persistence, but recalling commands and terminology remained harder than understanding the behavior through use.
- **Evidence:** First-hand CLI output from `gateway status`, `lsof`, `sessions`, and `sed`.
- **Severity:** Learning and operational usability friction.
- **Opportunity hypothesis:** Teach operational concepts through small prediction-and-verification exercises. Provide a compact recognition guide for status, persistence, recovery, and shutdown instead of expecting command memorization.
- **Next step taken:** Created a private operator card from commands verified during the walkthrough.

### Entry 56: A missing config path hid an active version-specific default

- **Stage:** Inspecting session persistence after a Gateway restart and TUI reconnection
- **Action:** Compared the prior and current internal session IDs, checked `session.reset`, inspected fresh token metadata, and listed session transcript artifacts.
- **Expected:** With no configured reset path, the existing session lifecycle would remain active.
- **Observed:** `openclaw config get session.reset --json` reported that the path did not exist. The stable key `agent:main:main` pointed to a new internal session ID with a fresh zero-token count. The old transcript was archived with a reset timestamp matching the first new TUI command. Source at the installed build's release line uses an implicit daily reset at 4:00 AM. Current `main` changed the default to no automatic reset after the installed build.
- **Reaction:** “Path not found” described the stored config but did not explain the effective behavior. The TUI rendered old history immediately before the first new command triggered a fresh lifecycle, which made persistence and active context appear contradictory.
- **Evidence:** First-hand `/status`, `config get`, `sessions --json`, and filesystem output; installed-build source; current source change `#111140`.
- **Severity:** Medium explainability and version-skew friction.
- **Opportunity hypothesis:** Distinguish stored values from effective defaults in config inspection. Mark restored history, lifecycle rollover, and the active context boundary in the TUI.
- **Next step taken:** Do not propose the already-landed default-policy change. Preserve the remaining explainability observations for later triage.

## Friction and trust inventory

This section will be synthesized from the chronological log after patterns repeat.

| Moment | Evidence | User impact | Frequency observed | Confidence |
| --- | --- | --- | --- | --- |
| Remote script is the most visible installation path | One-line installer command | Prevented installation on the primary Mac | Once, before installation | High |
| Install choices do not immediately answer where OpenClaw will live | User compared one-liner and npm but could not tell whether they affect the current computer | Could not choose a path based on privacy or isolation | Once, at Get Started | High |
| Safer environment guidance assumes operator knowledge | Official VM path uses Lume, SSH, IP addresses, configuration editing, and daemon terminology | Non-developers may not understand how to begin or what they are authorizing | Once, during VM research | High |
| Documented disk expectation differs from the configured VM disk | Guide says approximately 60 GB free per VM; Lume configured 102,400 MB and reported 107.37 GB | User may not know whether this is capacity or immediate host storage consumption | Once, during VM creation | Medium pending sparse-disk verification |
| VM launch produces an unexplained host microphone request | macOS permission prompt says Terminal wants microphone access | User must make a host privacy decision before continuing the isolated VM setup | Once, at first manual VM launch | High observation confidence; cause unverified |
| Routine VM status output includes a VNC session password | `lume get openclaw` displayed status, IP, SSH readiness, and a credential-bearing VNC URL together | User shared a diagnostic transcript without recognizing it contained a secret | Once, before first SSH connection | High |
| Fresh VM lacks Node and npm required by the next documented command | `node --version` and `npm --version` both returned `command not found`; VM guide proceeds directly to npm install | User reaches a blocker immediately after successfully following the VM and SSH setup | Once, on a fresh VM | High |
| `lume stop` returns without stopping the displayed VM | Three attempts found a lock-holding process; status remained running even after guest SSH became unavailable | User cannot confidently leave the VM shut down and may mistake returned shell control for success | Three times in one shutdown attempt | High |
| Installer dry run previews options rather than actions | Verified local `--dry-run --no-prompt --no-onboard` output listed OS, method, version, dry-run state, and onboarding state only | User still cannot see which prerequisites, downloads, destinations, shell changes, or services the real run would involve | Once, on a fresh VM | High |
| Successful installation does not guarantee command readiness | Both Lume and OpenClaw reported successful installation while also requiring a separate shell-profile change before the short command would reliably work | User may encounter `command not found`, repeat installation, or miss that setup remains incomplete | Twice across the host and VM installs | High |
| “No menus” onboarding cannot explain itself before a model exists | A natural-language request for exact changes, access, customization, cancellation, and undo fell through to the fixed deterministic-mode command list | User cannot obtain the information needed for informed consent through the interface's advertised interaction model | Once, at the first onboarding proposal | High |
| Bare `yes` authorizes undisclosed persistent setup | Exact-version source shows config/workspace/bootstrap writes, security acknowledgement, full setup-agent execution posture, and managed Gateway service setup behind the bundled proposal | User may authorize broader and more persistent changes than the visible summary implies | Once, verified before approval | High |
| Suggested Gateway diagnostic repeats reachability failure | `gateway status` returned the same unreachable address and connection failure without managed-service state | User still cannot distinguish absent, stopped, or failed service before choosing restart | Once after model authentication; source path verified on current `main` | High |
| Managed Gateway install mutates config before failing its macOS GUI-session prerequisite | The command set local mode and persisted a generated token before LaunchAgent bootstrap failed in the headless SSH session | “Install failed” leaves partial security and service-file state that the user must discover and reconcile | Once on the documented VM path; ordering verified in current source | High |

## Positive moments

Record things that work especially well. A credible case study should preserve strengths, not only problems.

- The macOS VM guide provides concrete compatibility requirements that were straightforward to verify once the guide was found.
- Once `PATH` was configured, `lume --version` and the top-level help provided immediate confirmation that the CLI worked and exposed the available capabilities clearly.
- The telemetry CLI provided distinct controls to disable collection and reset the installation ID, preserving the privacy preference while removing the identifier.
- Manual VM launch led into the familiar macOS Setup Assistant and reached a usable isolated desktop without further errors.
- The documented **General → Sharing → Remote Login** path matched the VM interface, and SSH could be enabled without turning on broader remote-management services.
- After the transient first close, a normal SSH retry produced a password prompt and entered the isolated VM successfully.
- The real installer uses a styled interface, verifies its temporary spinner helper, numbers major stages, and names the missing prerequisites as it begins work.
- The completion output resolved the moving `latest` label to the exact installed OpenClaw version, confirmed the installed Node and npm versions, preserved the onboarding choice, and supplied the full command path for resuming later.
- The model-provider picker uses a bounded menu, progressive disclosure, a visible safe exit, and explicit keyboard instructions—evidence that beginner-accessible CLI patterns already exist elsewhere in OpenClaw.

## Opportunity backlog

These are hypotheses, not commitments.

| Opportunity | Evidence needed | Possible scope | Status |
| --- | --- | --- | --- |
| Trust-oriented installation path | Complete the existing path and determine which concerns are already addressed | Documentation, website flow, or installer UX | Unvalidated |
| Isolated evaluation guidance | Test the current VM guidance | Documentation or guided path selection | Unvalidated |
| Explainable installation plan and receipt | Compare the current plan with actual system changes; resolve version aliases; explain preview and onboarding consequences; validate beginner comprehension | Installer CLI UX and verification | Strong first-hand evidence; leading candidate |
| Long-running operation liveness and recovery | Observe the real install's spinner, elapsed-time visibility, detail access, stall behavior, cancellation guidance, and resumability | Installer CLI UX | Parked pending direct observation |
| Goal-based environment chooser | Determine whether other newcomers distinguish install method from install location | Website information architecture or interactive path selector | Unvalidated |
| Beginner-oriented isolated trial | Observe whether a newcomer can reach a first useful result without understanding infrastructure concepts | Guided setup, glossary, or packaged evaluation environment | Unvalidated |
| Fresh-VM dependency handoff | Confirm maintainer-preferred Node installation path and reproduce from another clean VM if needed | Correct the macOS VM installation instructions | Strong first-hand evidence; solution unvalidated |

## Contribution decision criteria

A promising contribution should:

- Solve a problem observed during the real walkthrough.
- Avoid duplicating functionality that already exists.
- Be narrow enough to implement, test, and explain clearly.
- Fit OpenClaw's contribution process and maintainer direction.
- Demonstrate product judgment, interaction design, technical collaboration, and user control.
- Improve the product for users beyond this single case.

## Possible case-study structure

This outline will be completed only after the journey and contribution work are real.

1. Why I wanted to try OpenClaw
2. The first trust decision
3. How I studied the existing experience
4. What the evidence revealed
5. How I chose the contribution scope
6. Prototype and implementation
7. Local and user validation
8. Maintainer feedback and iteration
9. What shipped and what I learned

## Current checkpoint

Installation and command readiness are complete for OpenClaw v2026.7.1-2 (build `0790d9f`). The password-like credential exposed during installation has been rotated, though the macOS login keychain still uses its prior password until separately updated. OpenAI authentication is complete through the Codex plugin. The default model is `openai/gpt-5.6-sol`.

The `openclaw` VM is running headlessly. A foreground Gateway is running inside the VM on loopback port 18789. It is not installed as a macOS LaunchAgent. The Gateway uses token authentication, local mode, and disabled mDNS discovery. The config is valid. `plugins.allow` currently contains only `codex`, so the active Gateway loaded only the Codex plugin. This is an intentionally minimal capability set for the first controlled task. Lume telemetry remains disabled and no installation ID exists.

A separate `caffeinate -d` process is still running to keep the host awake during the walkthrough.

To resume, leave the foreground Gateway running. Use another SSH tab for diagnostics or the TUI. Do not enter or share a provider key, OAuth code, token, or other credential in the journey log.

### Resume note — July 22, 2026

The current official documentation was checked again and still contains the same handoff: the macOS VM guide proceeds directly to npm installation, while the general installer documentation says the hosted installer provisions Node automatically. Resume by running the VM headlessly in one host Terminal, then use JSON output filtered through `jq` in a second Terminal to reveal only status, IP address, and SSH readiness—not the credential-bearing VNC URL. Once reconnected, download the official installer without executing it and compare its checksum with a separately fetched copy before review.
