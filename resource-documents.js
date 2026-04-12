    const RESOURCE_DOCUMENTS = {
      'Tier Overview': `
        <h3>Vet Buddies Subscription Tiers</h3>
        <p>Vet Buddies offers three tiers of care coordination, each designed to keep pets healthier between vet visits.</p>
        <table>
          <tr><th></th><th>Buddy — $99/mo</th><th>Buddy+ — $149/mo</th><th>Buddy VIP — $279/mo</th></tr>
          <tr><td><strong>Vet Buddy Check-ins</strong></td><td>1 per month</td><td>1 per week</td><td>1 per week</td></tr>
          <tr><td><strong>Veterinarian Check-ins</strong></td><td>—</td><td>—</td><td>1 per month</td></tr>
          <tr><td><strong>Digital Living Care Plan</strong></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td><strong>Care Coordination</strong></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td><strong>Messaging</strong></td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><td><strong>Document Vault</strong></td><td>✓</td><td>✓</td><td>✓</td></tr>
        </table>
        <h3>What Is a Vet Buddy Check-in?</h3>
        <p>A check-in is a proactive outreach from a trained Vet Buddy (CSU veterinary student) to the client. During a check-in the Buddy:</p>
        <ul>
          <li>Reviews the pet's Living Care Plan for any upcoming action items</li>
          <li>Messages the client to ask about the pet's current condition, behavior, appetite, and energy</li>
          <li>Updates the care plan with the client's responses and any new observations</li>
          <li>Flags anything concerning for escalation to Dr. Rodgers</li>
        </ul>
        <h3>Veterinarian Check-ins (VIP Only)</h3>
        <p>Buddy VIP clients receive an additional monthly review from a licensed veterinarian who:</p>
        <ul>
          <li>Reviews the Living Care Plan and all Buddy notes from the past month</li>
          <li>Provides clinical commentary and adjustments to the care plan</li>
          <li>Sends a direct message to the client with a summary and any recommendations</li>
        </ul>
        <h3>Free Trial</h3>
        <p>All new clients receive a <strong>30-day free trial</strong> at the Buddy tier. During the trial they get full access to all Buddy-tier features. At the end of the trial they choose a paid plan or their access pauses.</p>
        <div class="callout">When discussing tiers with clients, focus on the value of proactive care and peace of mind — not just feature counts. The goal is matching the client to the tier that fits their pet's needs.</div>
      `,

      'Behavioral Consult Protocol': `
        <h3>Behavioral Consult Protocol</h3>
        <p>This protocol outlines how Vet Buddies should handle behavioral concerns raised by clients. Behavioral issues are common and can range from mild anxiety to aggression. Follow these steps carefully.</p>
        <h3>Step 1 — Gather Information</h3>
        <p>When a client reports a behavioral concern, collect the following before taking action:</p>
        <ul>
          <li><strong>What behavior?</strong> — Specific description (e.g., "growls when approached while eating," not just "aggressive")</li>
          <li><strong>When did it start?</strong> — New behavior vs. long-standing pattern</li>
          <li><strong>Frequency</strong> — Daily, weekly, only in certain situations?</li>
          <li><strong>Triggers</strong> — What seems to cause or worsen the behavior?</li>
          <li><strong>Changes at home</strong> — New people, pets, move, schedule change, diet change?</li>
          <li><strong>Medical history</strong> — Any recent illness, injury, or medication changes?</li>
        </ul>
        <h3>Step 2 — Assess Severity</h3>
        <table>
          <tr><th>Level</th><th>Examples</th><th>Action</th></tr>
          <tr><td><strong>Low</strong></td><td>Mild anxiety, occasional barking, leash pulling, house-training regression</td><td>Document in care plan, share general guidance, monitor at next check-in</td></tr>
          <tr><td><strong>Medium</strong></td><td>Resource guarding, separation anxiety causing destruction, fear-based avoidance</td><td>Document in care plan, recommend client discuss with their primary vet, flag for Dr. Rodgers review</td></tr>
          <tr><td><strong>High</strong></td><td>Aggression toward people or other animals, self-harm, sudden drastic behavior change</td><td>Escalate immediately to Dr. Rodgers via the escalation system</td></tr>
        </table>
        <h3>Step 3 — Document and Communicate</h3>
        <ul>
          <li>Add a detailed note to the pet's Living Care Plan under the relevant section</li>
          <li>Message the client with empathy and practical next steps — never diagnose or prescribe</li>
          <li>If escalating, use the in-app escalation button and select "Behavioral / Safety" as the type</li>
        </ul>
        <h3>Step 4 — Follow Up</h3>
        <p>At the next scheduled check-in, ask specifically about the behavioral concern. Update the care plan with progress or any new developments.</p>
        <div class="callout"><strong>Important:</strong> Vet Buddies do not diagnose behavioral conditions or recommend specific training techniques. Our role is to listen, document, coordinate, and escalate. Always direct clients to a qualified veterinary behaviorist for clinical advice.</div>
      `,

      'Welcome Script': `
        <h3>New Client Welcome Script</h3>
        <p>Use this script as a guide for your first message to a new client. Personalize it based on the pet's name, species, and any info from their onboarding.</p>
        <h3>Initial Welcome Message</h3>
        <div class="callout" style="white-space:pre-line;">Hi [Client Name]!

Welcome to Vet Buddies — I'm [Your Name], and I'll be [Pet Name]'s dedicated Vet Buddy!

I'm a veterinary student at CSU, and I'm here to help keep [Pet Name] healthy and happy between vet visits. Here's what you can expect from me:

• I'll check in [monthly / weekly, based on their tier] to see how [Pet Name] is doing
• I'll maintain a Living Care Plan — a living document that tracks [Pet Name]'s health, nutrition, medications, and milestones
• You can message me anytime through the app if something comes up

To get started, I'd love to learn a bit more about [Pet Name]. Could you tell me:
1. How old is [Pet Name] and how long have you had [him/her/them]?
2. Who is [Pet Name]'s primary veterinarian?
3. Are there any current health concerns or ongoing treatments I should know about?
4. Any allergies, dietary restrictions, or medications?

Looking forward to being part of [Pet Name]'s care team!</div>
        <h3>Key Points to Remember</h3>
        <ul>
          <li>Be warm and personal — this sets the tone for the entire relationship</li>
          <li>Use the pet's name, not "your pet"</li>
          <li>Introduce yourself by name and mention you're a CSU veterinary student</li>
          <li>Set clear expectations about check-in frequency based on their tier</li>
          <li>Ask open-ended questions to start building the care plan</li>
          <li>Don't overwhelm them — keep it to 3-4 questions max in the first message</li>
        </ul>
        <h3>After They Respond</h3>
        <p>Once the client replies with their pet's information:</p>
        <ol>
          <li>Thank them for sharing and acknowledge anything they mentioned</li>
          <li>Begin populating the Living Care Plan with the details provided</li>
          <li>If they mention any active health concerns, note them in the care plan and let the client know you'll keep an eye on those during check-ins</li>
          <li>Let them know when to expect their next check-in</li>
        </ol>
      `,

      'Compensation Structure': `
        <h3>CSU Student Compensation Structure</h3>
        <p>This document outlines compensation, hour tracking, and payment logistics for CSU veterinary students working as Vet Buddies.</p>
        <h3>Pay Rate</h3>
        <table>
          <tr><th>Role</th><th>Rate</th><th>Notes</th></tr>
          <tr><td>Vet Buddy (CSU Student)</td><td>$18/hour</td><td>Standard rate for all student Buddies</td></tr>
          <tr><td>Senior Buddy / Team Lead</td><td>$20/hour</td><td>After 6+ months and demonstrated performance</td></tr>
        </table>
        <h3>Billable Activities</h3>
        <p>The following activities count toward your compensated hours:</p>
        <ul>
          <li><strong>Client check-ins</strong> — Reviewing the care plan and messaging the client</li>
          <li><strong>Care plan updates</strong> — Adding notes, updating sections, documenting changes</li>
          <li><strong>Message responses</strong> — Replying to client messages within the app</li>
          <li><strong>Escalation handling</strong> — Writing up escalation reports and follow-ups</li>
          <li><strong>Team meetings</strong> — Scheduled team syncs and training sessions</li>
          <li><strong>Onboarding new clients</strong> — Welcome messages and initial care plan setup</li>
        </ul>
        <h3>Hour Tracking</h3>
        <ul>
          <li>Log your hours at the end of each work session</li>
          <li>Include a brief note of what you worked on (e.g., "Check-ins for 4 clients, updated 2 care plans")</li>
          <li>Hours are reviewed and approved biweekly</li>
          <li>Submit hours by <strong>end of day Sunday</strong> every two weeks</li>
        </ul>
        <h3>Payment Schedule</h3>
        <ul>
          <li>Pay period: Biweekly (every two weeks)</li>
          <li>Payment method: Direct deposit</li>
          <li>Processing time: Payments are issued within 5 business days of the pay period close</li>
        </ul>
        <h3>Expected Hours</h3>
        <table>
          <tr><th>Caseload</th><th>Estimated Hours/Week</th></tr>
          <tr><td>5-8 cases (starting)</td><td>3-5 hours</td></tr>
          <tr><td>9-15 cases (typical)</td><td>6-10 hours</td></tr>
          <tr><td>16+ cases (experienced)</td><td>10-15 hours</td></tr>
        </table>
        <div class="callout">Hours are flexible and built around your class schedule. Communicate with Dr. Rodgers if you need to adjust your availability during exams or breaks.</div>
      `,

      'CSU Student Handbook': `
        <h3>CSU Vet Buddies Student Handbook</h3>
        <p>Welcome to the Vet Buddies program. This handbook covers the policies, expectations, and clinical guidelines you need to know as a CSU veterinary student Vet Buddy.</p>
        <h3>Your Role</h3>
        <p>As a Vet Buddy, you are a trained care coordinator — not a diagnosing clinician. You serve as the bridge between the client and their veterinary care team, providing proactive support and maintaining a comprehensive care record.</p>
        <h3>Scope of Practice</h3>
        <p><strong>You CAN:</strong></p>
        <ul>
          <li>Ask about and document the pet's condition, behavior, appetite, energy, and symptoms</li>
          <li>Share general pet wellness information (nutrition, exercise, enrichment)</li>
          <li>Update and maintain the Living Care Plan</li>
          <li>Remind clients about upcoming vet appointments, medications, or preventive care</li>
          <li>Escalate concerns to Dr. Rodgers for clinical review</li>
        </ul>
        <p><strong>You CANNOT:</strong></p>
        <ul>
          <li>Diagnose any medical or behavioral condition</li>
          <li>Recommend specific medications, dosages, or treatments</li>
          <li>Advise a client to skip or delay veterinary care</li>
          <li>Provide second opinions on a veterinarian's diagnosis or treatment plan</li>
          <li>Share information about one client's pet with another client</li>
        </ul>
        <h3>Confidentiality</h3>
        <p>All client and pet information is confidential. Do not share case details outside the Vet Buddies platform. Do not discuss clients by name in public or on social media.</p>
        <h3>Communication Standards</h3>
        <ul>
          <li><strong>Response time:</strong> Respond to client messages within 24 hours on business days</li>
          <li><strong>Tone:</strong> Warm, professional, empathetic. Use the pet's name. Avoid medical jargon</li>
          <li><strong>Difficult conversations:</strong> If a client is upset, acknowledge their feelings, and escalate if needed. Never argue or become defensive</li>
          <li><strong>Boundaries:</strong> Keep communication within the app. Do not share personal phone numbers or social media</li>
        </ul>
        <h3>Clinical Guidelines</h3>
        <ul>
          <li>Always review the pet's care plan before a check-in</li>
          <li>Document every interaction — if it's not in the care plan, it didn't happen</li>
          <li>When in doubt, escalate. It is always better to flag a concern that turns out to be minor than to miss something serious</li>
          <li>Follow the Behavioral Consult Protocol for any behavioral concerns</li>
          <li>Follow the Emergency Escalation Protocol for urgent situations</li>
        </ul>
        <h3>Academic Integrity</h3>
        <p>This program is a professional experience. Treat it with the same seriousness as a clinical rotation. Missed check-ins, late responses, or careless documentation reflect on you and on the CSU veterinary program.</p>
        <div class="callout">Questions about policies or guidelines? Reach out to Dr. Rodgers directly through the app or during weekly team meetings.</div>
      `,

      'Emergency Escalation Protocol': `
        <h3>Emergency Escalation Protocol</h3>
        <p>This protocol defines when and how to escalate urgent concerns to Dr. Rodgers. When in doubt, escalate — it is always better to raise a concern than to miss something.</p>
        <h3>When to Escalate</h3>
        <p><strong>Escalate IMMEDIATELY if the client reports any of the following:</strong></p>
        <ul>
          <li>Pet is not breathing normally or is in respiratory distress</li>
          <li>Pet has collapsed, is seizing, or is unresponsive</li>
          <li>Suspected ingestion of a toxic substance</li>
          <li>Severe trauma (hit by car, fall from height, animal attack)</li>
          <li>Uncontrolled bleeding</li>
          <li>Sudden inability to walk or stand</li>
          <li>Signs of bloat in dogs (distended abdomen, retching without vomiting, restlessness)</li>
          <li>Pet has not eaten or had water for 48+ hours</li>
          <li>Sudden aggression or behavior that poses a safety risk to the pet or people</li>
        </ul>
        <div class="callout"><strong>In a true emergency:</strong> Your first message to the client should always be: <em>"If [Pet Name] is in immediate danger, please call your nearest emergency vet or the ASPCA Poison Control Hotline at (888) 426-4435 right now."</em> Then escalate in the app.</div>
        <h3>How to Escalate</h3>
        <ol>
          <li>Open the case in the app and click the <strong>⚠️ Escalate</strong> button</li>
          <li>Select the appropriate escalation type:
            <ul>
              <li><strong>Medical / Urgent</strong> — Health emergency or rapid decline</li>
              <li><strong>Behavioral / Safety</strong> — Aggression or behavior posing risk</li>
              <li><strong>Adverse Outcome</strong> — Something has gone wrong (injury, reaction, death)</li>
              <li><strong>Client Concern</strong> — Client is distressed, upset, or requesting clinical guidance beyond your scope</li>
            </ul>
          </li>
          <li>Write a clear, factual description of the situation in the reason field</li>
          <li>For adverse outcomes, fill in the incident notes field with full details</li>
          <li>Submit the escalation — Dr. Rodgers will be notified immediately</li>
        </ol>
        <h3>What Happens After Escalation</h3>
        <ul>
          <li>Dr. Rodgers reviews the escalation and the pet's care plan</li>
          <li>Dr. Rodgers may message the client directly, contact their primary vet, or provide you with guidance</li>
          <li>The escalation status will update to <strong>Acknowledged</strong> and then <strong>Resolved</strong></li>
          <li>You may be asked to follow up with the client after resolution</li>
        </ul>
        <h3>Non-Emergency Escalations</h3>
        <p>Not all escalations are emergencies. You should also escalate for:</p>
        <ul>
          <li>A client asking clinical questions you're not qualified to answer</li>
          <li>A care plan issue that needs veterinary input</li>
          <li>A client expressing dissatisfaction with the service</li>
          <li>Anything that makes you uncomfortable or unsure</li>
        </ul>
        <div class="callout"><strong>Remember:</strong> You will never be penalized for escalating. Escalating a concern that turns out to be minor is always the right call. Failing to escalate something serious is the only mistake.</div>
      `
    };
