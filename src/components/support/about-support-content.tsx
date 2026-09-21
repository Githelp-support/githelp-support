"use client"

interface AboutSupportContentProps {
  projectName: string
}

const SUPPORT_AREAS = [
  "Problems",
  "Bugs",
  "Dependencies",
  "Breaking changes",
  "Best practices",
  "Mentoring",
  "Code reviews",
  "Documentation",
]

/**
 * "About support" tab content — shared between the public /support page tabs
 * and the user-portal /support/about route.
 */
export function AboutSupportContent({ projectName }: AboutSupportContentProps) {
  return (
    <div className="space-y-16">
      {/* How support works section */}
      <div className="max-w-[37rem]">
        <h2 className="text-[22px] font-normal text-[#444444] mb-6">How support works</h2>
        <p className="text-sm text-[#444444] mb-4">
          The <span className="font-semibold">{projectName}</span> team can help out with issues related to areas such
          as:
        </p>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_AREAS.map((area) => (
            <span
              key={area}
              className="px-4 py-2 border border-[#554abf] text-[#554abf] rounded-md text-sm"
              style={{ fontFamily: 'Cousine, monospace' }}
            >
              {area}
            </span>
          ))}
        </div>
      </div>

      {/* Get started section */}
      <div>
        <h2 className="text-xl font-normal text-[#444444] mb-6">Get started</h2>
        <div className="bg-white rounded-lg p-8 border border-[#E1E1E1] shadow-none max-w-[52rem]">
          <div className="space-y-0 max-w-[36rem]">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
              </div>
              <div className="flex-1 pb-8">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Choose how to get help</h3>
                <p className="text-sm text-[#868c98]">
                  You can get help through standard support or through an SLA. Getting help through an SLA requires
                  no registration, if accepted by your employer.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Register or share details</h3>
                <p className="text-sm text-[#868c98]">
                  Register an account or share your email and card details before getting started. Registration only
                  takes a couple of minutes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receive help section */}
      <div>
        <h2 className="text-xl font-normal text-[#444444] mb-6">Receive help</h2>
        <div className="bg-white rounded-lg p-8 border border-[#E1E1E1] shadow-none max-w-[52rem]">
          <div className="space-y-0 max-w-[36rem]">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
              </div>
              <div className="flex-1 pb-8">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Wait for a helper to connect</h3>
                <p className="text-sm text-[#868c98]">
                  How long it takes varies. Looking into &quot;Rates and details&quot; will give you an idea about average
                  waiting time. The helper is normally someone on the core team of the project.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
              </div>
              <div className="flex-1 pb-8">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Start chatting</h3>
                <p className="text-sm text-[#868c98]">
                  Describe your issue, in text or by sharing code, and get help. If the helper can&apos;t help you, you
                  are normally not charged anything.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Issue is solved</h3>
                <p className="text-sm text-[#868c98]">
                  When you are pleased with the assistance, the chat is ended, and time spent is logged by the
                  helper.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment and reports section */}
      <div>
        <h2 className="text-xl font-normal text-[#444444] mb-6">Payment and reports</h2>
        <div className="bg-white rounded-lg p-8 border border-[#E1E1E1] shadow-none max-w-[52rem]">
          <div className="space-y-0 max-w-[36rem]">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
                <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
              </div>
              <div className="flex-1 pb-8">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Choose how to pay</h3>
                <p className="text-sm text-[#868c98]">
                  If you are using support both privately and through your employer, you are asked to specify who
                  you want the support charged to. The amount is charged to your card.
                </p>
                <p className="text-sm text-[#868c98] mt-2">
                  Payment is then made to the helper, with a commission also going to the project you are getting
                  support with. In this case <span className="font-semibold">{projectName}</span>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#554abf] flex-shrink-0"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[#444444] mb-2">Receive documentation</h3>
                <p className="text-sm text-[#868c98]">
                  You will receive a report via cards or email, showing payment and support details. If you are
                  registered, you can also retrieve any support documentation from the Github user login page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
