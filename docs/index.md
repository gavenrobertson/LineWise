---
layout: home
title: LineWise
titleTemplate: Network diagrams that know the network

hero:
  name: LineWise
  text: Network diagrams that know the network
  tagline: A free, open-source, offline desktop app for Cisco-style network diagrams where every icon is a real device with interfaces, IP addresses, VLANs and links.
  image:
    light: /lockup-light.svg
    dark: /lockup-dark.svg
    alt: LineWise — network architecture diagrams
  actions:
    - theme: brand
      text: Get started
      link: /user/getting-started
    - theme: alt
      text: Download
      link: https://github.com/gavenrobertson/linewise/releases/latest
    - theme: alt
      text: Developer guide
      link: /dev/

features:
  - title: Devices with real interfaces
    details: Connect Gi0/1 on a router to Gi1/0/24 on a switch, assign 10.0.12.1/30, and LineWise knows the link, the subnet and the VLANs.
  - title: Physical, data link and network views
    details: One model, three views (L1, L2, L3), with VLAN and shortest-path highlights.
  - title: Validation as you draw
    details: Duplicate IPs, subnet mismatches, trunk and native-VLAN mismatches, speed and duplex mismatches and more, with one-click fixes.
  - title: Import from Cisco CLI
    details: Paste show cdp neighbors, show lldp neighbors, show running-config and more. Secrets are stripped and never stored.
  - title: Export anything
    details: PNG, SVG, PDF with a title block, CSV inventories and IP plans, HTML and Markdown reports, draw.io, Containerlab, Mermaid and DOT.
  - title: Private and offline
    details: No account and no telemetry. The only network request is the update check, and you can turn it off.
---
