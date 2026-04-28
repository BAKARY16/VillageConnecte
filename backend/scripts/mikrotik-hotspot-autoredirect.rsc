# Village Connecte - MikroTik Hotspot auto-redirect baseline
# Objectif:
# - ouverture automatique du portail captif sur un maximum d'appareils
# - compatibilite forte via HTTP captive
# - HTTPS laisse actif si besoin, sans en dependre pour l'auto-ouverture
#
# A ADAPTER avant import:
# - bridge LAN/WiFi
# - interface WAN
# - IP du routeur hotspot
# - IP du backend API

:local bridgeName "bridge"
:local wanList "WAN"
:local hotspotProfile "default"
:local hotspotServer "hotspot1"
:local hotspotAddress "10.5.50.253"
:local hotspotCidr "10.5.50.0/24"
:local dnsName "villageconnecte.voisilab"
:local backendApiIp "10.5.50.252"
:local backendApiPort "3001"

# 1) DNS du MikroTik pour tous les clients
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8

# 2) Le reseau DHCP doit distribuer le MikroTik comme DNS et gateway
/ip dhcp-server network
:foreach item in=[find] do={
  :local currentAddress [get $item address]
  :if ($currentAddress = $hotspotCidr) do={
    set $item gateway=$hotspotAddress dns-server=$hotspotAddress comment="Village Connecte hotspot"
  }
}

# 3) NAT Internet sortant
/ip firewall nat
:if ([:len [find where chain="srcnat" action="masquerade" out-interface-list=$wanList]] = 0) do={
  add chain=srcnat action=masquerade out-interface-list=$wanList comment="Village Connecte WAN masquerade"
}

# 4) Profil Hotspot: HTTP d'abord pour l'ouverture captive automatique
/ip hotspot profile set [find name=$hotspotProfile] \
  hotspot-address=$hotspotAddress \
  dns-name=$dnsName \
  login-by=http-pap,https \
  html-directory=hotspot \
  http-cookie-lifetime=1d

# 5) Serveur Hotspot attache au profil cible
/ip hotspot set [find name=$hotspotServer] profile=$hotspotProfile addresses-per-mac=2 idle-timeout=5m keepalive-timeout=2m

# 6) Walled-garden minimum avant authentification
# Backend API captive
/ip hotspot walled-garden ip
:if ([:len [find where dst-address=$backendApiIp dst-port=$backendApiPort protocol="tcp"]] = 0) do={
  add action=accept protocol=tcp dst-address=$backendApiIp dst-port=$backendApiPort comment="Village Connecte backend API"
}

# DNS du MikroTik autorise pour les clients non-authentifies
:if ([:len [find where protocol="udp" dst-port="53"]] = 0) do={
  add action=accept protocol=udp dst-host=$dnsName dst-port=53 comment="Village Connecte DNS UDP"
}
:if ([:len [find where protocol="tcp" dst-port="53"]] = 0) do={
  add action=accept protocol=tcp dst-host=$dnsName dst-port=53 comment="Village Connecte DNS TCP"
}

# Optionnel: si le checkout FedaPay est utilise avant authentification, decommenter si necessaire
# /ip hotspot walled-garden add action=accept dst-host=cdn.fedapay.com comment="FedaPay CDN"
# /ip hotspot walled-garden add action=accept dst-host=sandbox-checkout.fedapay.com comment="FedaPay checkout sandbox"
# /ip hotspot walled-garden add action=accept dst-host=checkout.fedapay.com comment="FedaPay checkout live"

# IMPORTANT:
# Ne PAS mettre en walled-garden les endpoints de detection captive des OS
# (captive.apple.com, connectivitycheck.gstatic.com, msftconnecttest.com, generate_204, etc.)
# Sinon les appareils croient qu'Internet fonctionne deja et n'ouvrent pas le portail.

# 7) Rappels operatoires
:put "Configuration appliquee. Verifier ensuite:" 
:put "- le hotspot sert bien login.html / redirect.html depuis html-directory=hotspot"
:put "- les clients recoivent DNS=$hotspotAddress via DHCP"
:put "- le backend captive repond sur http://$backendApiIp:$backendApiPort"
:put "- l'auto-ouverture se base sur HTTP captive; HTTPS autosigne reste optionnel"