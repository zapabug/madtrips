// Social Graph Diagnostic Tool
// Run this in the browser console while on the Community page

async function diagnoseGraphVisualization() {
  console.log('%c==== SOCIAL GRAPH DIAGNOSIS ====', 'font-size: 16px; font-weight: bold; color: blue;');
  
  // Store diagnostic results
  const results = {
    api: { status: 'pending', data: null, message: '' },
    dom: { status: 'pending', message: '' },
    d3: { status: 'pending', message: '' },
    svg: { status: 'pending', message: '' },
    rendering: { status: 'pending', message: '' },
  };
  
  // 1. Check API data
  console.log('Testing API connection...');
  try {
    const response = await fetch('/api/socialgraph');
    if (!response.ok) {
      results.api.status = 'error';
      results.api.message = `API returned status ${response.status}`;
    } else {
      const data = await response.json();
      results.api.data = data;
      
      if (!data || !data.nodes || !data.links) {
        results.api.status = 'error';
        results.api.message = 'API returned invalid data structure';
      } else if (data.nodes.length === 0) {
        results.api.status = 'warning';
        results.api.message = 'API returned empty nodes array';
      } else {
        results.api.status = 'success';
        results.api.message = `API returned ${data.nodes.length} nodes and ${data.links.length} links`;
      }
    }
  } catch (error) {
    results.api.status = 'error';
    results.api.message = `API fetch failed: ${error.message}`;
  }
  
  // 2. Check DOM for visualization container
  console.log('Checking DOM elements...');
  const svgContainer = document.querySelector('.nodes'); // D3 creates this class
  const svgElement = document.querySelector('svg');
  
  if (!svgElement) {
    results.dom.status = 'error';
    results.dom.message = 'No SVG element found in DOM';
  } else {
    results.dom.status = 'success';
    results.dom.message = `Found SVG element: ${svgElement.width?.baseVal?.value || 'unknown'} x ${svgElement.height?.baseVal?.value || 'unknown'}`;
    
    // Check if SVG has content
    const svgChildren = svgElement.querySelectorAll('*');
    if (svgChildren.length < 5) { // Just a basic check
      results.svg.status = 'warning';
      results.svg.message = `SVG found but has minimal content (${svgChildren.length} elements)`;
    } else {
      results.svg.status = 'success';
      results.svg.message = `SVG has ${svgChildren.length} elements`;
    }
  }
  
  // 3. Check for D3 library
  if (typeof d3 === 'undefined') {
    results.d3.status = 'error';
    results.d3.message = 'D3 library not found';
  } else {
    results.d3.status = 'success';
    results.d3.message = `D3 version ${d3.version} detected`;
  }
  
  // 4. Check for rendering issues
  if (!svgContainer) {
    results.rendering.status = 'error';
    results.rendering.message = 'No .nodes container found, visualization not rendered';
  } else {
    const nodeElements = svgContainer.querySelectorAll('circle');
    if (nodeElements.length === 0) {
      results.rendering.status = 'error';
      results.rendering.message = 'Visualization container exists but no nodes rendered';
    } else {
      results.rendering.status = 'success';
      results.rendering.message = `Found ${nodeElements.length} rendered nodes`;
    }
  }
  
  // Report results
  console.log('%c==== DIAGNOSIS RESULTS ====', 'font-size: 16px; font-weight: bold; color: green;');
  
  for (const [test, result] of Object.entries(results)) {
    const color = result.status === 'success' ? 'green' : (result.status === 'warning' ? 'orange' : 'red');
    console.log(`%c${test.toUpperCase()}: ${result.status}`, `font-weight: bold; color: ${color}`);
    console.log(result.message);
    
    if (test === 'api' && result.data) {
      console.log('Data sample:', result.data.nodes.slice(0, 3));
    }
  }
  
  // Final assessment and recommendations
  console.log('%c==== RECOMMENDATIONS ====', 'font-size: 16px; font-weight: bold; color: blue;');
  
  if (results.api.status === 'error') {
    console.log('%cFix API issues first:', 'font-weight: bold');
    console.log('- Check server logs for errors');
    console.log('- Verify the API route is correctly implemented');
    console.log('- Try forcing an update via /api/socialgraph?update=true');
  } else if (results.d3.status === 'error') {
    console.log('%cD3 library issue:', 'font-weight: bold');
    console.log('- Check if D3 is properly loaded (dynamic import may have failed)');
    console.log('- Try importing D3 directly in your component');
  } else if (results.svg.status === 'error' || results.rendering.status === 'error') {
    console.log('%cRendering issues:', 'font-weight: bold');
    console.log('- Check browser console for errors during render');
    console.log('- Verify container dimensions (might be zero width/height)');
    console.log('- Try adding explicit width/height to your container');
    console.log('- Check if your data format matches what D3 expects');
  } else if (results.api.status === 'warning') {
    console.log('%cData issues:', 'font-weight: bold');
    console.log('- You have empty data - try updating the social graph');
    console.log('- Check the data structure to ensure it matches what the visualization expects');
  } else if (Object.values(results).every(r => r.status === 'success')) {
    console.log('%cAll tests passed!', 'font-weight: bold; color: green');
    console.log('If you still have issues, check:');
    console.log('- CSS issues (container might be hidden or have zero size)');
    console.log('- Force simulation parameters (may need adjustment)');
    console.log('- Browser compatibility issues');
  }
  
  return results;
}

// Run the diagnostics
diagnoseGraphVisualization().then(results => {
  console.log('Diagnosis complete. See above for details.');
  window._diagResults = results; // Store for further inspection
}); 