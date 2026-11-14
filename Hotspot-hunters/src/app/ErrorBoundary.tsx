import {Component,type ErrorInfo,type ReactNode} from 'react';
export default class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(_error:Error,_info:ErrorInfo){/* Never render internal exception details or untrusted payloads. */}
 render(){return this.state.failed?<main className="app"><section className="workspace-page" role="alert"><h1>The interface needs a fresh start.</h1><p>An unexpected display error occurred. Your saved local research remains on this browser. No data source was silently substituted.</p><button onClick={()=>window.location.reload()}>Reload application</button></section></main>:this.props.children;}
}
