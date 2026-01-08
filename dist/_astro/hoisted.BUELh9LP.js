import"./Header.astro_astro_type_script_index_0_lang.CuYPaftd.js";async function s(){try{const e=await(await fetch("/metrics")).json(),d=document.getElementById("dashboard-content");d.innerHTML=`
          <div class="grid md:grid-cols-2 gap-6">
            <div class="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Total Requests</h3>
              <p class="text-3xl font-bold text-slate-900 dark:text-white">${e.totalRequests||0}</p>
            </div>
            
            <div class="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Error Rate</h3>
              <p class="text-3xl font-bold text-slate-900 dark:text-white">${((e.errorRate||0)*100).toFixed(2)}%</p>
            </div>
            
            <div class="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Avg Latency</h3>
              <p class="text-3xl font-bold text-slate-900 dark:text-white">${(e.avgLatency||0).toFixed(0)}ms</p>
            </div>
            
            <div class="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Cache Hit Rate</h3>
              <p class="text-3xl font-bold text-slate-900 dark:text-white">${((e.cacheHitRate||0)*100).toFixed(2)}%</p>
            </div>
          </div>
          
          <div class="mt-8 p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h3 class="font-semibold text-slate-900 dark:text-white mb-4">Backend Services</h3>
            <div class="space-y-3">
              ${Object.entries(e.backends||{}).map(([r,a])=>`
                <div class="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-900">
                  <span class="font-medium text-slate-900 dark:text-white">${r}</span>
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full ${a.healthy?"bg-green-500":"bg-red-500"}"></div>
                    <span class="text-sm text-slate-600 dark:text-slate-400">${a.healthy?"Healthy":"Unhealthy"}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `}catch(t){document.getElementById("dashboard-content").innerHTML=`
          <div class="text-red-600 dark:text-red-400">
            <p>Error loading dashboard: ${t}</p>
          </div>
        `}}s();setInterval(s,1e4);
