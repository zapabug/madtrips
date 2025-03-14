# Bitcoin-Accepting Businesses in Madeira

This document lists all Bitcoin-accepting businesses in Madeira, sourced from BTCMap.org.

## API Integration

This data is fetched from the BTCMap API endpoint:
```
https://api.btcmap.org/v2/venues?area_id=free-madeira
```

### API Response Format
```typescript
interface Business {
  id: string
  name: string
  tags?: string[]
}
```

## Active Businesses

### Bitcoin Beach Madeira
- **Name**: Bitcoin Beach Madeira
- **Tags**: beach, bar, restaurant

### Digital Nomad Hub
- **Name**: Digital Nomad Hub
- **Tags**: coworking, community

## Contributing

To add or update a business listing:
1. Visit [BTCMap.org](https://btcmap.org)
2. Navigate to the Madeira area
3. Add or edit the business information
4. Submit for review

## Last Updated
- Date: 2024
- Source: BTCMap.org
- API Version: v2 